"""Read saved HTML as data; never execute archived scripts or fetch linked assets."""
from html.parser import HTMLParser

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Node:
    def __init__(self, tag, attrs=None, line=0):
        self.tag, self.attrs, self.line = tag, dict(attrs or []), line
        self.children = []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self):
        if self.tag in {'script', 'style', 'svg'}:
            return ''
        return ''.join(c.text() if isinstance(c, Node) else c for c in self.children)


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('document')
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.getpos()[0])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def compact(value):
    return ' '.join(value.split())
