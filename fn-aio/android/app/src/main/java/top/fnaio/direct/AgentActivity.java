package top.fnaio.direct;

/**
 * 「Agent」桌面入口：复用 DSH 的 WebView 宿主、悬浮球与下载管理，
 * 保存多个网址并一键切换；飞牛 AIO 服务地址沿用 FN ID 登录处理，其余按直连加载。
 */
public final class AgentActivity extends MainActivity {
    @Override protected boolean webEntry() { return true; }
}
