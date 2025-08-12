function deepCompare(a, b) {
  if (!(a instanceof Object && b instanceof Object)) {
    return a === b;
  }
  for (const key in a) {
    if (!(key in b)) return false;
    if (!deepCompare(a[key], b[key])) return false;
  }
  for (const key in b) {
    if (!(key in a)) return false;
  }
  return true;
}
