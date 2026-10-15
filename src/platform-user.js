export const DEFAULT_PLATFORM_USER = Object.freeze({
  id: 'demo-professor',
  displayName: '王教授',
  roleName: '演示 · 课题负责人',
  avatarText: '王',
  authenticated: false,
  mode: 'demo',
});

let demoProfile={};
try{demoProfile=JSON.parse(localStorage.getItem('lingshu-demo-profile')||'{}');}catch{}
let currentUser = {
  ...DEFAULT_PLATFORM_USER,
  ...(demoProfile.displayName?{displayName:demoProfile.displayName,roleName:'演示 · '+demoProfile.roleName,avatarText:demoProfile.displayName.slice(0,1)}:{}),
  ...(window.__QIYAN_USER__ ?? {}),
};

export function getPlatformUser() {
  return { ...currentUser };
}

export function setPlatformUser(user) {
  currentUser = user
    ? { ...DEFAULT_PLATFORM_USER, ...user, authenticated: user.authenticated ?? true }
    : { displayName: '未登录', roleName: '登录后访问', avatarText: '访', authenticated: false };

  window.dispatchEvent(new CustomEvent('qiyan:user-change', {
    detail: getPlatformUser(),
  }));
}
