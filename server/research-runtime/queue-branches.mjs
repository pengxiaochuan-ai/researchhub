// Enqueue transactions follow the active entry context; worker claims retain
// the original elevated client and its existing authorization checks.
export function withQueueBranches(prisma, branches) {
  return new Proxy(prisma, {
    get(target, key) {
      if (key === 'app') {
        const branch = branches.find(candidate => candidate?.active);
        if (branch) return branch.prisma.app;
      }
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
