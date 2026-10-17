"""Loopback-only web app and evidence-backed AI mentor API."""

from __future__ import annotations

import ipaddress
import json
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "docs"


def load_local_environment() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line_number, raw_line in enumerate(env_file.read_text(encoding="utf-8-sig").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise SystemExit(f".env 第 {line_number} 行格式无效。")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ.setdefault(key, value)


load_local_environment()

HOST = "127.0.0.1"
try:
    PORT = int(os.environ.get("MENTOR_PORT", "8765"))
except ValueError as exc:
    raise SystemExit("MENTOR_PORT 必须是 1 至 65535 之间的端口。") from exc
MAX_BODY_SIZE = 256 * 1024
MAX_GOALS = 20
MAX_TEXT_SIZE = 800
RATE_WINDOW_SECONDS = 300
RATE_LIMIT = 6
RATE_LOCK = threading.Lock()
REQUEST_TIMES: dict[str, list[float]] = {}


class MentorError(Exception):
    """An expected, user-safe mentor service error."""


class ConfigurationError(MentorError):
    status_code = 503


class RequestValidationError(MentorError):
    status_code = 400


class RateLimitError(MentorError):
    status_code = 429


def required_setting(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigurationError(
            f"导师服务尚未配置 {name}。请在 .env 中补充配置并重启服务。"
        )
    return value


def validate_remote_endpoint(raw_url: str) -> str:
    parsed = urllib.parse.urlsplit(raw_url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or not parsed.path.endswith("/chat/completions")
    ):
        raise ConfigurationError(
            "LLM_API_URL 必须是可信 AI 服务的 HTTPS chat/completions 接口地址。"
        )
    try:
        addresses = socket.getaddrinfo(
            parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise ConfigurationError("无法解析 LLM_API_URL 的主机名，请检查网络与配置。") from exc
    if not addresses or any(
        not ipaddress.ip_address(address[4][0]).is_global for address in addresses
    ):
        raise ConfigurationError("LLM_API_URL 不能指向本机、内网或非公网地址。")
    return raw_url


def remote_json_request(
    url: str,
    *,
    payload: dict | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
) -> dict:
    request_headers = {"Accept": "application/json", **(headers or {})}
    encoded_body = None
    if payload is not None:
        encoded_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        url, data=encoded_body, headers=request_headers, method="POST" if payload else "GET"
    )
    opener = urllib.request.build_opener(_NoRedirectHandler())
    try:
        with opener.open(request, timeout=timeout) as response:
            body = response.read(2_000_001)
    except urllib.error.HTTPError as exc:
        detail = exc.read(500).decode("utf-8", errors="replace").strip()
        if exc.code == 429:
            raise MentorError("导师服务调用过于频繁，请稍后重试。") from exc
        if exc.code in (401, 403):
            raise MentorError("AI 或检索服务认证失败，请核对 API 密钥。") from exc
        raise MentorError(
            f"上游服务返回 HTTP {exc.code}。"
            + (f"详情：{detail}" if detail else "")
        ) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise MentorError("连接外部 AI 或检索服务失败，请检查网络及服务状态。") from exc
    if len(body) > 2_000_000:
        raise MentorError("外部服务响应过大，已停止处理。")
    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MentorError("外部服务返回了无法识别的 JSON 数据。") from exc
    if not isinstance(result, dict):
        raise MentorError("外部服务返回格式无效。")
    return result


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def clean_text(value: object, limit: int = MAX_TEXT_SIZE) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def validate_date(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise RequestValidationError(f"{field} 日期格式无效。")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise RequestValidationError(f"{field} 日期格式无效。") from exc
    if parsed.isoformat() != value:
        raise RequestValidationError(f"{field} 日期格式无效。")
    return value


def validate_payload(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise RequestValidationError("导师请求内容格式无效。")
    today = validate_date(payload.get("today"), "今天")
    selected_date = validate_date(payload.get("selected_date"), "选择的")
    vision_data = payload.get("vision")
    vision = vision_data if isinstance(vision_data, dict) else {}
    raw_goals = payload.get("goals")
    if not isinstance(raw_goals, list) or len(raw_goals) > MAX_GOALS:
        raise RequestValidationError(f"一次最多分析 {MAX_GOALS} 个目标。")
    goals = []
    for goal in raw_goals:
        if not isinstance(goal, dict):
            continue
        raw_items = goal.get("items")
        items = []
        if isinstance(raw_items, list):
            items = [
                {
                    "title": clean_text(item.get("title"), 150),
                    "done": item.get("done") is True,
                }
                for item in raw_items[:60]
                if isinstance(item, dict) and clean_text(item.get("title"), 150)
            ]
        goals.append(
            {
                "id": clean_text(goal.get("id"), 80),
                "title": clean_text(goal.get("title"), 120),
                "category": clean_text(goal.get("category"), 80),
                "description": clean_text(goal.get("description"), 500),
                "current": goal.get("current") if isinstance(goal.get("current"), (int, float)) else 0,
                "target": goal.get("target") if isinstance(goal.get("target"), (int, float)) else 0,
                "unit": clean_text(goal.get("unit"), 24),
                "progress_percent": min(
                    100,
                    max(
                        0,
                        float(goal.get("progress_percent"))
                        if isinstance(goal.get("progress_percent"), (int, float))
                        else 0,
                    ),
                ),
                "items": items,
            }
        )
    raw_tasks = payload.get("recent_daily_tasks")
    if not isinstance(raw_tasks, list) or len(raw_tasks) > 80:
        raise RequestValidationError("最近任务列表格式无效或数量过多。")
    daily_tasks = []
    for task in raw_tasks:
        if not isinstance(task, dict):
            continue
        task_date = validate_date(task.get("date"), "任务")
        if task_date > selected_date:
            continue
        title = clean_text(task.get("title"), 150)
        if title:
            daily_tasks.append(
                {"date": task_date, "title": title, "done": task.get("done") is True}
            )
    return {
        "today": today,
        "selected_date": selected_date,
        "vision": {
            "title": clean_text(vision.get("title"), 120),
            "description": clean_text(vision.get("description"), 500),
        },
        "goals": [goal for goal in goals if goal["title"]],
        "recent_daily_tasks": daily_tasks,
    }


def acquire_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    with RATE_LOCK:
        requests = [
            timestamp
            for timestamp in REQUEST_TIMES.get(client_ip, [])
            if now - timestamp < RATE_WINDOW_SECONDS
        ]
        if len(requests) >= RATE_LIMIT:
            raise RateLimitError("导师调用次数已达上限，请稍后再试。")
        requests.append(now)
        REQUEST_TIMES[client_ip] = requests


def external_source(source_id: str, title: str, url: str, kind: str, snippet: str,
                    published_at: str = "") -> dict | None:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    return {
        "id": source_id,
        "title": title[:300],
        "url": url[:1200],
        "kind": kind,
        "snippet": snippet[:1200],
        "published_at": published_at[:40],
    }


def search_openalex(goal: dict, polite_email: str) -> list[dict]:
    query = " ".join(
        part for part in (goal["title"], goal["category"], goal["description"][:100]) if part
    )
    if not query:
        return []
    current_year = date.today().year
    params = {
        "search": query[:350],
        "filter": f"from_publication_date:{current_year - 7}-01-01",
        "sort": "publication_date:desc",
        "per-page": "3",
        "select": "id,doi,title,publication_year,authorships,primary_location,type,abstract_inverted_index",
    }
    if polite_email:
        params["mailto"] = polite_email
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
    result = remote_json_request(url, timeout=25)
    works = result.get("results")
    if not isinstance(works, list):
        raise MentorError("OpenAlex 学术文献服务返回格式无效。")
    sources = []
    for index, work in enumerate(works[:3], start=1):
        if not isinstance(work, dict):
            continue
        title = clean_text(work.get("title"), 300)
        if not title:
            continue
        doi = clean_text(work.get("doi"), 500)
        openalex_url = clean_text(work.get("id"), 500)
        url = doi if doi.startswith("https://doi.org/") else openalex_url
        authorships = work.get("authorships")
        author_names = []
        if isinstance(authorships, list):
            for author in authorships[:3]:
                if isinstance(author, dict) and isinstance(author.get("author"), dict):
                    name = clean_text(author["author"].get("display_name"), 80)
                    if name:
                        author_names.append(name)
        year = work.get("publication_year")
        abstract_index = work.get("abstract_inverted_index")
        abstract_words = []
        if isinstance(abstract_index, dict):
            positioned_words = []
            for word, positions in abstract_index.items():
                if isinstance(word, str) and isinstance(positions, list):
                    positioned_words.extend(
                        (position, word)
                        for position in positions[:300]
                        if isinstance(position, int) and position >= 0
                    )
            abstract_words = [
                word for _, word in sorted(positioned_words)[:500]
            ]
        abstract = " ".join(abstract_words)[:3500]
        summary = (
            f"论文年份：{year or '未标注'}。作者：{', '.join(author_names) or '未标注'}。"
            + (f" OpenAlex 索引摘要：{abstract}" if abstract else " OpenAlex 未提供摘要。")
        )
        source = external_source(
            f"OA-{goal['id']}-{index}",
            title,
            url,
            "学术文献（OpenAlex 索引）",
            summary,
            str(year) if year else "",
        )
        if source:
            sources.append(source)
    return sources


def search_web(goals: list[dict]) -> list[dict]:
    api_key = required_setting("TAVILY_API_KEY")
    goal_terms = "; ".join(f"{goal['category']}: {goal['title']}" for goal in goals[:10])
    query = (
        f"近期权威机构资料和行业趋势；关键主题：{goal_terms}。"
        "优先政府、大学、研究机构与专业组织，给出可核验的原始来源和发布日期。"
    )
    result = remote_json_request(
        "https://api.tavily.com/search",
        payload={
            "api_key": api_key,
            "query": query[:1000],
            "topic": "general",
            "search_depth": "advanced",
            "max_results": 8,
            "include_answer": False,
        },
        timeout=30,
    )
    results = result.get("results")
    if not isinstance(results, list):
        raise MentorError("实时网页检索服务返回格式无效。")
    sources = []
    for index, item in enumerate(results[:8], start=1):
        if not isinstance(item, dict):
            continue
        title = clean_text(item.get("title"), 300)
        url = clean_text(item.get("url"), 1200)
        if not title:
            continue
        source = external_source(
            f"WEB-{index}",
            title,
            url,
            "近期网页资料（Tavily 检索）",
            clean_text(item.get("content"), 1200),
            clean_text(item.get("published_date"), 40),
        )
        if source:
            sources.append(source)
    return sources


def collect_sources(goals: list[dict]) -> list[dict]:
    search_email = os.environ.get("OPENALEX_MAILTO", "").strip()
    sources: list[dict] = []
    failures = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(search_openalex, goal, search_email): goal["title"]
            for goal in goals[:10]
        }
        futures[pool.submit(search_web, goals)] = "近期网络资料"
        for future in as_completed(futures):
            label = futures[future]
            try:
                sources.extend(future.result())
            except MentorError as exc:
                failures.append(f"{label}：{exc}")
    if failures:
        raise MentorError("证据检索未全部成功，未生成无来源建议。" + "；".join(failures[:3]))
    if not sources:
        raise MentorError("未检索到可核验的网页或学术来源，请调整目标描述后重试。")
    return sources[:30]


def generate_advice(payload: dict) -> dict:
    clean_payload = validate_payload(payload)
    if not clean_payload["goals"]:
        raise MentorError("请先创建至少一个目标，再生成导师建议。")
    model = required_setting("LLM_MODEL")
    api_key = required_setting("LLM_API_KEY")
    endpoint = validate_remote_endpoint(required_setting("LLM_API_URL"))
    sources = collect_sources(clean_payload["goals"])
    instructions = """
你是一位严谨、尊重用户自主权的跨领域成长规划导师。只根据给定用户资料和来源，为目标制定现实、具体、可复核的行动建议。
每条建议必须引用给定来源 ID；不得编造论文、作者、统计数据、社会趋势或来源；没有充分证据时请明确说不知道、降低信心并注明外推限制。
把近期网页资料和学术文献区分开；优先近期、可靠、与目标直接相关的证据。搜索结果只是线索，不代表已经阅读全文或验证其结论。
健康、饮食、体质问题不作诊断，不把“水多木漂”等传统标签当作确诊依据，不开药、不制定替代医疗的治疗/调养方案；建议用户记录体验，遇到症状求助合格医疗人员。不要将现代医学证据与传统理论混为一谈。
理财只建议预算、风险识别、学习与核实信息；不承诺收益，不指定个性化买卖指令。技能、文化、形象、运动建议应适度、可持续、尊重个体条件。
你仅提供建议，不创建或修改用户的目标、任务、金额和饮食。把大目标拆成一周内可以开始、带时间或数量标准的步骤。
只返回 JSON，不要 Markdown，严格符合 schema：
{"summary":"总体判断","recommendations":[{"title":"针对的目标","rationale":"理由及证据强弱","steps":["具体、可执行且可衡量的步骤"],"confidence":"高/中/低","caveat":"必要的适用限制，或空字符串","evidence_ids":["已提供的来源 ID"]}],"limitations":["证据或个性化限制"]}
recommendations 给出 3 至 7 项，尽量覆盖不同目标并指出优先级。evidence_ids 只能使用下面资料中的 ID，不相关时仍可说明证据不足，但不得伪造引用。
""".strip()
    context = {"user_plan": clean_payload, "retrieved_sources": sources}
    response = remote_json_request(
        endpoint,
        payload={
            "model": model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": instructions},
                {
                    "role": "user",
                    "content": json.dumps(context, ensure_ascii=False),
                },
            ],
        },
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=75,
    )
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise MentorError("AI 服务没有返回建议内容。")
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, list):
        content = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        )
    if not isinstance(content, str):
        raise MentorError("AI 服务返回了不支持的建议格式。")
    try:
        advice = json.loads(content)
    except json.JSONDecodeError as exc:
        raise MentorError("AI 服务未按要求返回 JSON，未展示未经校验的建议。") from exc
    if not isinstance(advice, dict) or not isinstance(advice.get("recommendations"), list):
        raise MentorError("AI 建议结构无效，未展示未经校验的内容。")
    known_sources = {source["id"]: source for source in sources}
    recommendations = []
    for item in advice["recommendations"][:10]:
        if not isinstance(item, dict):
            continue
        title = clean_text(item.get("title"), 200)
        steps = item.get("steps")
        evidence_ids = item.get("evidence_ids")
        if not title or not isinstance(steps, list) or not isinstance(evidence_ids, list):
            continue
        valid_evidence = [
            source_id
            for source_id in evidence_ids[:10]
            if isinstance(source_id, str) and source_id in known_sources
        ]
        if not valid_evidence:
            continue
        recommendations.append(
            {
                "title": title,
                "rationale": clean_text(item.get("rationale"), 1000),
                "steps": [
                    clean_text(step, 500)
                    for step in steps[:10]
                    if isinstance(step, str) and clean_text(step, 500)
                ],
                "confidence": clean_text(item.get("confidence"), 60),
                "caveat": clean_text(item.get("caveat"), 500),
                "evidence_ids": valid_evidence,
            }
        )
    if not recommendations:
        raise MentorError("AI 没有生成符合验证规则的行动建议，请稍后重试。")
    mentioned_source_ids = {
        source_id
        for recommendation in recommendations
        for source_id in recommendation["evidence_ids"]
    }
    cited_sources = [source for source in sources if source["id"] in mentioned_source_ids]
    limitations = advice.get("limitations")
    if not isinstance(limitations, list):
        limitations = []
    limitations = [clean_text(item, 500) for item in limitations[:10] if isinstance(item, str)]
    limitations.extend(
        [
            "检索到的网页摘要和文献索引不是全文审读；相关性、研究质量与时效性仍应核验。",
            "建议由 AI 生成，仅供决策参考；不会自动执行或修改你的目标。",
        ]
    )
    return {
        "summary": clean_text(advice.get("summary"), 1500),
        "recommendations": recommendations,
        "limitations": limitations,
        "sources": cited_sources,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
    }


class MentorRequestHandler(BaseHTTPRequestHandler):
    server_version = "LocalGrowthMentor/1.0"
    sys_version = ""

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        )
        super().end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorize_local_request(self) -> bool:
        try:
            client_ip = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            return False
        if not client_ip.is_loopback:
            return False
        host_header = self.headers.get("Host", "")
        try:
            host = urllib.parse.urlsplit(f"http://{host_header}").hostname
        except ValueError:
            return False
        if host not in {"localhost", "127.0.0.1"}:
            return False
        origin = self.headers.get("Origin")
        if origin:
            parsed = urllib.parse.urlsplit(origin)
            if (
                parsed.scheme != "http"
                or parsed.hostname not in {"localhost", "127.0.0.1"}
                or parsed.port != PORT
            ):
                return False
        return True

    def do_GET(self) -> None:
        if not self.authorize_local_request():
            self.send_json(403, {"error": "只允许通过本机地址访问导师服务。"})
            return
        if self.path == "/api/health":
            config = {
                "ai": all(os.environ.get(key, "").strip() for key in ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL")),
                "web_search": bool(os.environ.get("TAVILY_API_KEY", "").strip()),
                "literature_search": True,
            }
            self.send_json(200, {"ok": True, "configured": config})
            return
        paths = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/index.html": ("index.html", "text/html; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/service-worker.js": ("service-worker.js", "text/javascript; charset=utf-8"),
            "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json; charset=utf-8"),
            "/icon.svg": ("icon.svg", "image/svg+xml; charset=utf-8"),
        }
        entry = paths.get(self.path)
        if not entry:
            self.send_json(404, {"error": "找不到请求的页面。"})
            return
        relative_path, content_type = entry
        body = (WEB_ROOT / relative_path).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if not self.authorize_local_request():
            self.send_json(403, {"error": "只允许通过本机地址访问导师服务。"})
            return
        if self.path != "/api/advisor":
            self.send_json(404, {"error": "找不到请求的导师接口。"})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "导师接口只接受 JSON 请求。"})
            return
        raw_length = self.headers.get("Content-Length", "")
        try:
            length = int(raw_length)
        except ValueError:
            self.send_json(411, {"error": "请求缺少有效的 Content-Length。"})
            return
        if length <= 0 or length > MAX_BODY_SIZE:
            self.send_json(413, {"error": "请求数据为空或超过 256 KB 上限。"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            acquire_rate_limit(self.client_address[0])
            advice = generate_advice(payload)
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "请求 JSON 格式无效。"})
            return
        except MentorError as exc:
            self.send_json(exc.status_code if hasattr(exc, "status_code") else 502, {"error": str(exc)})
            return
        self.send_json(200, advice)

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        if re.search(r"[\r\n]", message):
            message = message.replace("\r", "").replace("\n", "")
        print(f"[mentor] {self.log_date_time_string()} {message}")


def main() -> None:
    if not 1 <= PORT <= 65535:
        raise SystemExit("MENTOR_PORT 必须是 1 至 65535 之间的端口。")
    server = ThreadingHTTPServer((HOST, PORT), MentorRequestHandler)
    print(f"目标应用及导师服务已启动：http://{HOST}:{PORT}")
    print("导师 API 密钥仅从服务器环境变量读取；按 .env.example 配置后重启。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止本机导师服务。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
