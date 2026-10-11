"""Format these scenario recipes with bounded indentation and no external dependency."""

import json
import re

LEXEME = re.compile(
    r"(?P<space>\s+)|(?P<comment>--[^\n]*|/\*[\s\S]*?\*/)"
    r"|(?P<string>'(?:''|[^'])*')|(?P<quoted>\"(?:\"\"|[^\"])*\")"
    r"|(?P<dollar>\$(?:\w+)?\$)|(?P<directive>\\[^\n]*)"
    r"|(?P<word>[A-Za-z_][\w$]*|\d+(?:\.\d+)?)"
    r"|(?P<symbol>::|:=|->>|->|#>>|#>|<=|>=|<>|!=|\|\||.)"
)


def tokens(source):
    """Keep quotes, dollar bodies and psql directives atomic while reading SQL."""
    result = []
    position = 0
    gap_has_newline = False
    while position < len(source):
        match = LEXEME.match(source, position)
        kind, value = match.lastgroup, match.group()
        position = match.end()
        if kind == "space":
            gap_has_newline = gap_has_newline or "\n" in value
            continue
        if kind == "dollar":
            end = source.index(value, position)
            value += source[position:end] + value
            position = end + len(match.group())
        if kind == "string" and gap_has_newline and result and result[-1][0] == "string":
            # PostgreSQL joins adjacent standard string literals only when their
            # separating whitespace contains a newline. Preserve their exact value.
            result[-1] = (kind, result[-1][1][:-1] + value[1:])
        else:
            result.append((kind, value))
        gap_has_newline = False
    return result


def literal_lines(value, width):
    """Pretty-print JSON or split an unchanged SQL string using newline concatenation."""
    content = value[1:-1].replace("''", "'")
    if content.lstrip().startswith(("{", "[")):
        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            pass
        else:
            pretty = json.dumps(payload, ensure_ascii=False, indent=4)
            assert json.loads(pretty) == payload
            lines = ("'" + pretty.replace("'", "''") + "'").splitlines()
            assert all(len(line) <= width for line in lines), "JSON field exceeds SQL width"
            return lines
    if len(value) <= width:
        return [value]
    lines = []
    while content:
        size = min(len(content), width - 2)
        while len(content[:size].replace("'", "''")) + 2 > width:
            size -= 1
        boundary = content.rfind(" ", 0, size)
        if boundary >= size // 2:
            size = boundary + 1
        lines.append("'" + content[:size].replace("'", "''") + "'")
        content = content[size:]
    return lines


def expression_layout(source, base=0):
    """Wrap expressions at token boundaries with four spaces per parenthesis level."""
    lines = []
    line = ""
    depth = 0
    previous = ""
    items = tokens(source)
    skip = -1

    def flush():
        nonlocal line
        if line:
            lines.append("    " * (base + depth) + line)
            line = ""

    for index, (kind, value) in enumerate(items):
        if index == skip:
            continue
        if kind in ("comment", "directive"):
            flush()
            lines.extend("    " * (base + depth) + item for item in value.splitlines())
        elif kind == "dollar":
            tag = re.match(r"\$(?:\w+)?\$", value)[0]
            body = value[len(tag) : -len(tag)]
            if line.lower() == "do":
                lines.append("    " * (base + depth) + line + " " + tag)
                line = ""
            else:
                flush()
                lines.append("    " * (base + depth) + tag)
            body_lines = (
                procedural_layout(body)
                if re.search(r"\b(begin|declare)\b", body, re.I)
                else expression_layout(body, 1)
            )
            lines.extend(body_lines)
            lines.append("    " * (base + depth) + tag)
        elif value in ("(", "["):
            closing = ")" if value == "(" else "]"
            if index + 1 < len(items) and items[index + 1][1] == closing:
                line += value + closing
                skip = index + 1
                previous = closing
                continue
            line += value
            flush()
            depth += 1
        elif value in (")", "]"):
            flush()
            depth -= 1
            assert depth >= 0, "Unbalanced SQL expression"
            line = value
        elif value in (",", ";"):
            if not line and lines:
                lines[-1] += value
            else:
                line += value
                flush()
        elif kind == "string":
            width = 116 - 4 * (base + depth)
            parts = literal_lines(value, width)
            if len(parts) > 1:
                flush()
                lines.extend("    " * (base + depth) + item for item in parts)
            else:
                space = "" if not line or previous in (".", "::") else " "
                if len(line) + len(space) + len(value) > width:
                    flush()
                    space = ""
                line += space + value
        else:
            space = "" if not line or value in (".", "::") or previous in (".", "::") else " "
            if len(line) + len(space) + len(value) + 4 * (base + depth) > 116:
                flush()
                space = ""
            line += space + value
        previous = value
    flush()
    assert depth == 0, "Unclosed SQL expression"
    return lines


def procedural_layout(source):
    """Indent declarations and procedural control blocks without column alignment."""
    items = tokens(source)
    lines = []
    level = 0
    declaration = False
    index = 0

    def through(end):
        nonlocal index
        selected = []
        depth = 0
        while index < len(items):
            kind, value = items[index]
            selected.append((kind, value))
            index += 1
            if value in ("(", "["):
                depth += 1
            elif value in (")", "]"):
                depth -= 1
            if depth == 0 and value.lower() == end:
                break
        # Separating every lexeme with whitespace preserves punctuation, quotes and words.
        return " ".join(value for _, value in selected)

    while index < len(items):
        kind, value = items[index]
        word = value.lower()
        if kind == "comment":
            lines.append("    " * level + value)
            index += 1
        elif word == "declare":
            lines.append("    " * level + value)
            level += 1
            declaration = True
            index += 1
        elif word == "begin":
            if declaration:
                level -= 1
                declaration = False
            lines.append("    " * level + value)
            level += 1
            index += 1
        elif word in ("if", "elsif"):
            if word == "elsif":
                level -= 1
            lines.extend(expression_layout(through("then"), level))
            level += 1
        elif word in ("for", "while", "foreach"):
            lines.extend(expression_layout(through("loop"), level))
            level += 1
        elif word in ("else", "exception"):
            level -= 1
            lines.append("    " * level + value)
            level += 1
            index += 1
        elif word == "end":
            level -= 1
            assert level >= 0
            text = value
            index += 1
            if index < len(items) and items[index][1].lower() in ("if", "loop"):
                text += " " + items[index][1]
                index += 1
            if index < len(items) and items[index][1] == ";":
                text += ";"
                index += 1
            lines.append("    " * level + text)
        else:
            lines.extend(expression_layout(through(";"), level))
    assert level == 0, "Unclosed procedural block"
    return lines


def format_sql(source):
    """Return LF SQL with bounded lines and no blank lines within a statement."""
    formatted = "\n".join(expression_layout(source)) + "\n"
    assert all(len(line) <= 120 for line in formatted.splitlines())
    return formatted
