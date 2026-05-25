"""System workflow templates (seeded via migration)."""

from __future__ import annotations

from typing import Any

CONTRACT_REVIEW_STEPS: list[dict[str, Any]] = [
    {
        "key": "extract_summary",
        "type": "llm",
        "prompt": (
            "你是资深法务助手。请从以下合同中提取：主体双方、合同金额、期限、付款方式、"
            "违约责任、争议解决方式。用简洁中文条目列出。\n\n合同内容：\n{{input.contract_text}}"
        ),
    },
    {
        "key": "retrieve_rules",
        "type": "retrieve",
        "query_template": (
            "合同类型：{{input.contract_type}}，审查模式：{{input.review_mode}}，"
            "风险规则、标准条款、合规要求"
        ),
    },
    {
        "key": "check_retrieval",
        "type": "condition",
        "when": "low_confidence",
        "retrieve_step_key": "retrieve_rules",
        "message": "未检索到足够的规则依据，请补充知识库或调整合同类型后重试。",
    },
    {
        "key": "risk_review",
        "type": "llm",
        "prompt": (
            "你是合同审查专家。基于合同摘要、原文与检索到的规则，输出风险清单。"
            "每条风险包含：等级(高/中/低)、条款位置、原文摘录、问题说明、修改建议、依据引用编号。\n\n"
            "合同类型：{{input.contract_type}}\n审查模式：{{input.review_mode}}\n\n"
            "合同摘要：\n{{steps.extract_summary.text}}\n\n"
            "检索上下文：\n{{steps.retrieve_rules.context_text}}"
        ),
    },
    {
        "key": "format_report",
        "type": "format",
        "format": "markdown",
        "template": (
            "# 合同审查报告\n\n"
            "> 本报告由 AI 生成，仅供参考，不构成法律意见。\n\n"
            "## 合同概览\n{{steps.extract_summary.text}}\n\n"
            "## 风险清单\n{{steps.risk_review.text}}\n\n"
            "## 缺失条款与建议\n请人工复核关键条款是否完整。"
        ),
    },
]

FAQ_GENERATION_STEPS: list[dict[str, Any]] = [
    {
        "key": "retrieve_topics",
        "type": "retrieve",
        "query_template": "{{input.topic}} FAQ 常见问题 知识点",
    },
    {
        "key": "generate_faq",
        "type": "llm",
        "prompt": (
            "根据检索到的资料，为主题「{{input.topic}}」生成 {{input.count}} 条 FAQ。"
            "每条包含 question 与 answer，使用 Markdown 列表。\n\n"
            "资料：\n{{steps.retrieve_topics.context_text}}"
        ),
    },
    {"key": "format_output", "type": "format", "format": "markdown", "template": "{{steps.generate_faq.text}}"},
]

CUSTOMER_REPLY_STEPS: list[dict[str, Any]] = [
    {
        "key": "analyze_question",
        "type": "llm",
        "system": (
            "你是客服质检助手。只做问题分析，不要直接回复客户。"
            "输出必须简洁，使用中文 Markdown。"
        ),
        "prompt": (
            "分析以下客户问题，输出四个小节：\n\n"
            "## 问题摘要\n（一句话）\n\n"
            "## 客户意图\n（咨询/投诉/售后/账单/功能使用/其他）\n\n"
            "## 紧急程度\n（结合输入：{{input.urgency}}）\n\n"
            "## 建议检索关键词\n"
            "（5-10 个词，空格分隔，用于检索知识库）\n\n"
            "---\n"
            "渠道：{{input.channel}}\n"
            "产品线：{{input.product_line}}\n"
            "客户背景：{{input.customer_context}}\n"
            "客户问题：\n{{input.customer_question}}"
        ),
    },
    {
        "key": "retrieve_policy",
        "type": "retrieve",
        "query_template": (
            "{{input.customer_question}} {{steps.analyze_question.text}} "
            "{{input.product_line}} 客服政策 处理规范 FAQ 退款 赔付 时效"
        ),
        "top_k": 10,
    },
    {
        "key": "check_retrieval",
        "type": "condition",
        "when": "low_confidence",
        "retrieve_step_key": "retrieve_policy",
        "message": (
            "知识库中未找到足够相关的客服政策或 FAQ。"
            "请补充知识库文档（如退款规则、赔付标准、响应时效）后重试，"
            "或改由人工接手处理。"
        ),
    },
    {
        "key": "draft_reply",
        "type": "llm",
        "system": (
            "你是资深客服文案。根据知识库撰写可直接发送或微调后发送的回复。"
            "硬性要求：\n"
            "1. 仅使用参考资料中确实存在的信息，不得编造政策、金额、时效。\n"
            "2. 参考资料无依据时，明确说明需进一步核实，并给出合理下一步。\n"
            "3. 引用政策时使用 [1]、[2] 等编号，对应参考资料段落编号。\n"
            "4. 语气符合指定风格，避免过度承诺与法律风险措辞。\n"
            "5. 输出中文，除非客户问题主要为英文。"
        ),
        "prompt": (
            "请撰写客服回复草稿。\n\n"
            "【渠道】{{input.channel}}\n"
            "【语气】{{input.tone}}\n"
            "【长度】{{input.reply_length}}\n"
            "【紧急程度】{{input.urgency}}\n\n"
            "【客户问题】\n{{input.customer_question}}\n\n"
            "【客户背景】\n{{input.customer_context}}\n\n"
            "【问题分析】\n{{steps.analyze_question.text}}\n\n"
            "【参考资料】\n{{steps.retrieve_policy.context_text}}\n\n"
            "输出结构：\n"
            "1. 开场（称呼/致谢，1-2 句）\n"
            "2. 正文（逐点回应，含必要引用编号）\n"
            "3. 下一步行动（客户需要做什么、我们会在何时反馈）\n"
            "4. 结尾（礼貌收尾）"
        ),
    },
    {
        "key": "compliance_review",
        "type": "llm",
        "system": (
            "你是客服合规复核员。检查回复草稿是否存在越权承诺、错误政策引用或遗漏关键提醒。"
            "输出修订后的完整回复；如草稿基本合格，可做少量润色并保持结构。"
        ),
        "prompt": (
            "复核以下回复草稿。参考资料：\n{{steps.retrieve_policy.context_text}}\n\n"
            "若需升级人工，在文末单独增加一行：「【升级建议】...」。\n\n"
            "草稿：\n{{steps.draft_reply.text}}"
        ),
    },
    {
        "key": "format_reply",
        "type": "format",
        "format": "markdown",
        "source_key": "compliance_review",
        "template": (
            "# 客服回复草稿\n\n"
            "> 渠道：{{input.channel}} | 语气：{{input.tone}} | "
            "紧急程度：{{input.urgency}}\n"
            "> 本内容由 AI 生成，发送前请人工核对政策与数字。\n\n"
            "## 问题分析摘要\n{{steps.analyze_question.text}}\n\n"
            "## 推荐回复（可直接复制）\n\n"
            "{{steps.compliance_review.text}}\n\n"
            "## 参考依据\n"
            "以下编号与检索段落对应，发送前请确认是否仍需向客户展示。\n\n"
            "{{steps.retrieve_policy.context_text}}"
        ),
    },
]

REPORT_GENERATION_STEPS: list[dict[str, Any]] = [
    {
        "key": "retrieve_data",
        "type": "retrieve",
        "query_template": "{{input.report_topic}} {{input.time_range}} 数据 指标",
    },
    {
        "key": "write_report",
        "type": "llm",
        "prompt": (
            "撰写结构化分析报告。主题：{{input.report_topic}}，时间范围：{{input.time_range}}。"
            "包含摘要、关键发现、数据解读、建议。\n\n资料：\n{{steps.retrieve_data.context_text}}"
        ),
    },
    {
        "key": "format_output",
        "type": "format",
        "format": "markdown",
        "template": "# {{input.report_topic}} 报告\n\n{{steps.write_report.text}}",
    },
]

SOP_EXTRACTION_STEPS: list[dict[str, Any]] = [
    {
        "key": "retrieve_sop",
        "type": "retrieve",
        "query_template": "{{input.process_name}} 标准操作流程 SOP 步骤",
    },
    {
        "key": "extract_sop",
        "type": "llm",
        "prompt": (
            "从资料中提取「{{input.process_name}}」的标准操作流程，"
            "按步骤编号、责任人、注意事项输出 Markdown。\n\n"
            "{{steps.retrieve_sop.context_text}}"
        ),
    },
    {"key": "format_output", "type": "format", "format": "markdown", "template": "{{steps.extract_sop.text}}"},
]


def _linear_graph(steps: list[dict[str, Any]]) -> dict[str, Any]:
    nodes = [{"id": s["key"], "type": s["type"], "data": {"label": s["key"]}} for s in steps]
    edges = []
    for i in range(len(steps) - 1):
        edges.append({"id": f"e-{i}", "source": steps[i]["key"], "target": steps[i + 1]["key"]})
    return {"nodes": nodes, "edges": edges}


SYSTEM_TEMPLATES: list[dict[str, Any]] = [
    {
        "key": "contract_review",
        "name": "合同审查",
        "description": "提取合同要点，结合知识库规则输出风险清单与审查报告。",
        "category": "legal",
        "input_schema": {
            "type": "object",
            "required": ["contract_text"],
            "properties": {
                "contract_text": {
                    "type": "string",
                    "title": "合同内容",
                    "ui:widget": "file",
                    "ui:accept": ".pdf,.docx,.txt,.md",
                },
                "contract_type": {
                    "type": "string",
                    "title": "合同类型",
                    "enum": ["采购合同", "销售合同", "服务合同", "NDA"],
                    "default": "服务合同",
                },
                "review_mode": {
                    "type": "string",
                    "title": "审查模式",
                    "enum": ["快速审查", "严格审查"],
                    "default": "快速审查",
                },
            },
        },
        "steps": CONTRACT_REVIEW_STEPS,
        "output_schema": {"type": "string", "format": "markdown"},
        "default_graph": _linear_graph(CONTRACT_REVIEW_STEPS),
    },
    {
        "key": "faq_generation",
        "name": "FAQ 生成",
        "description": "基于知识库为指定主题批量生成常见问题与答案。",
        "category": "content",
        "input_schema": {
            "type": "object",
            "required": ["topic"],
            "properties": {
                "topic": {"type": "string", "title": "主题"},
                "count": {"type": "integer", "title": "条数", "default": 10, "minimum": 1, "maximum": 50},
            },
        },
        "steps": FAQ_GENERATION_STEPS,
        "default_graph": _linear_graph(FAQ_GENERATION_STEPS),
    },
    {
        "key": "customer_reply",
        "name": "客服回复",
        "description": (
            "分析问题意图，检索客服政策与 FAQ，生成带引用编号的回复草稿，"
            "并经合规复核后输出可复制文稿。"
        ),
        "category": "support",
        "input_schema": {
            "type": "object",
            "required": ["customer_question"],
            "properties": {
                "customer_question": {
                    "type": "string",
                    "title": "客户问题",
                    "ui:widget": "textarea",
                },
                "customer_context": {
                    "type": "string",
                    "title": "客户背景（可选）",
                    "ui:widget": "textarea",
                },
                "channel": {
                    "type": "string",
                    "title": "渠道",
                    "enum": ["在线客服", "邮件", "工单", "电话纪要"],
                    "default": "在线客服",
                },
                "tone": {
                    "type": "string",
                    "title": "语气",
                    "enum": ["专业", "亲切", "简洁", "正式致歉"],
                    "default": "专业",
                },
                "urgency": {
                    "type": "string",
                    "title": "紧急程度",
                    "enum": ["普通", "加急", "投诉"],
                    "default": "普通",
                },
                "reply_length": {
                    "type": "string",
                    "title": "回复长度",
                    "enum": ["简短", "适中", "详细"],
                    "default": "适中",
                },
                "product_line": {
                    "type": "string",
                    "title": "产品线/业务",
                    "default": "",
                },
            },
        },
        "steps": CUSTOMER_REPLY_STEPS,
        "default_graph": _linear_graph(CUSTOMER_REPLY_STEPS),
    },
    {
        "key": "report_generation",
        "name": "报告生成",
        "description": "检索资料并生成结构化分析报告。",
        "category": "analytics",
        "input_schema": {
            "type": "object",
            "required": ["report_topic"],
            "properties": {
                "report_topic": {"type": "string", "title": "报告主题"},
                "time_range": {"type": "string", "title": "时间范围", "default": "最近一季度"},
            },
        },
        "steps": REPORT_GENERATION_STEPS,
        "default_graph": _linear_graph(REPORT_GENERATION_STEPS),
    },
    {
        "key": "sop_extraction",
        "name": "SOP 提取",
        "description": "从知识库文档中提取标准操作流程。",
        "category": "operations",
        "input_schema": {
            "type": "object",
            "required": ["process_name"],
            "properties": {
                "process_name": {"type": "string", "title": "流程名称"},
            },
        },
        "steps": SOP_EXTRACTION_STEPS,
        "default_graph": _linear_graph(SOP_EXTRACTION_STEPS),
    },
]


def get_system_template(key: str) -> dict[str, Any] | None:
    for tpl in SYSTEM_TEMPLATES:
        if tpl["key"] == key:
            return tpl
    return None


def list_system_templates() -> list[dict[str, Any]]:
    return list(SYSTEM_TEMPLATES)
