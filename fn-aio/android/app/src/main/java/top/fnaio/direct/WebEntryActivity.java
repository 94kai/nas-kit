package top.fnaio.direct;

/**
 * 「网页」桌面入口：复用 DSH 的 WebView 宿主、悬浮球与下载管理，
 * 直接加载用户在本入口「设置」里保存的 HTTP(S) 域名，不做飞牛登录处理。
 */
public final class WebEntryActivity extends MainActivity {
    @Override protected boolean webEntry() { return true; }
}
