package top.fnaio.direct;

/**
 * 「导航」桌面入口：复用 DSH 的 WebView 宿主、悬浮球与下载管理，
 * 保存多个网址并切换，不做飞牛登录处理。
 */
public final class WebEntryActivity extends MainActivity {
    @Override protected boolean webEntry() { return true; }
}
