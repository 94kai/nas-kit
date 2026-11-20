package top.fnaio.direct;

import java.net.URI;
import java.util.Locale;

/** The chosen route, not a redirect, decides whether NAS authentication is used. */
public final class AccessRoute {
    public enum Navigation { IN_APP, EXTERNAL, BLOCKED }
    public enum BackAction { CLOSE_MENU, GO_BACK, CONFIRM_EXIT }
    public final AccessPolicy nas;
    public final boolean direct;
    private final String directUrl;
    private final String directOrigin;

    public AccessRoute(AccessPolicy nas, String directUrl, boolean direct) {
        this.nas = nas;
        this.direct = direct;
        this.directUrl = directUrl;
        if (directUrl == null || directUrl.isEmpty()) {
            if (direct) throw new IllegalArgumentException("尚未配置直连入口");
            directOrigin = null;
            return;
        }
        try {
            URI uri = new URI(directUrl);
            String scheme = uri.getScheme();
            if ((!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                    || uri.getRawPath().contains("\\") || !uri.normalize().equals(uri)
                    || uri.getPort() == 0 || uri.getPort() > 65535 || uri.getPort() < -1) {
                throw new IllegalArgumentException();
            }
            directOrigin = scheme.toLowerCase(Locale.ROOT) + "://" + uri.getRawAuthority().toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            throw new IllegalArgumentException("直连入口必须是无凭据、无片段的 HTTP(S) 地址");
        }
    }
    public boolean requiresNasLogin() { return !direct; }
    public String entry() { return direct ? directUrl : nas.target(); }
    public boolean allows(String url) { return direct ? sameDirectOrigin(url) : nas.sameOrigin(url); }
    private boolean sameDirectOrigin(String value) {
        try {
            URI b = new URI(value);
            return b.getRawUserInfo() == null
                    && (b.getScheme() + "://" + b.getRawAuthority()).equalsIgnoreCase(directOrigin);
        } catch (Exception e) { return false; }
    }
    public Navigation navigation(String url) {
        if (allows(url)) return Navigation.IN_APP;
        return safeExternal(url) ? Navigation.EXTERNAL : Navigation.BLOCKED;
    }
    public static boolean safeExternal(String url) {
        try {
            URI uri = new URI(url);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawUserInfo() == null
                    && uri.getPort() != 0 && uri.getPort() <= 65535 && uri.getPort() >= -1;
        } catch (Exception e) { return false; }
    }
    public static BackAction backAction(boolean menuExpanded, boolean hasHistory) {
        if (menuExpanded) return BackAction.CLOSE_MENU;
        return hasHistory ? BackAction.GO_BACK : BackAction.CONFIRM_EXIT;
    }
}
