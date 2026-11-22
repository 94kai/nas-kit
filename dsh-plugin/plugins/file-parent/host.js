// 本插件没有 Host 侧行为：文件读取与目录打开都由 dsh-better-sidebar 完成。
// 保留一个空插件行，让包作为 bundle 被组合、客户端半边才能被加载。
export function apply() {}
