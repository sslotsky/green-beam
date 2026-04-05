function jsx(type, props, ...children) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children.length > 0 ? children : undefined } };
}

module.exports = { jsx, Fragment: 'Fragment' };
