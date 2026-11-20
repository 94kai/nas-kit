#!/usr/bin/env bash
# 本机 Android 出包脚本（机器无关，随 git 同步；不含任何密钥）。
# 用法：cd fn-aio && ./scripts/build-android.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1) 自动定位 JDK 17（优先环境变量，其次常见路径，最后从 PATH 反推）。
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME}/bin/javac" ]; then
  for c in /opt/homebrew/opt/openjdk@17 /home/xuekai/tools/jdk-17 \
           /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/java-17; do
    if [ -x "$c/bin/javac" ]; then JAVA_HOME="$c"; break; fi
  done
  if [ -z "${JAVA_HOME:-}" ] && command -v javac >/dev/null 2>&1; then
    JAVA_HOME="$(cd "$(dirname "$(command -v javac)")/.." && pwd)"
  fi
fi
[ -x "${JAVA_HOME:?}/bin/javac" ] || { echo "找不到 JDK 17（javac），请设置 JAVA_HOME"; exit 1; }
export JAVA_HOME

# 2) 自动定位 Android SDK（优先环境变量，其次常见路径）。
if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "${ANDROID_HOME}/platforms" ]; then
  for c in /opt/homebrew/share/android-commandlinetools /home/xuekai/android-sdk \
           "$HOME/Library/Android/sdk" /usr/local/share/android-commandlinetools; do
    if [ -d "$c/platforms" ]; then ANDROID_HOME="$c"; break; fi
  done
fi
[ -d "${ANDROID_HOME:?}/platforms" ] || { echo "找不到 Android SDK，请设置 ANDROID_HOME"; exit 1; }
export ANDROID_HOME

# 3) 若工作区已备好 Gradle 用户目录则复用（供不允许写 ~/.gradle 的沙箱），否则用系统默认。
if [ -d "$ROOT/.local/gradle-home" ]; then export GRADLE_USER_HOME="$ROOT/.local/gradle-home"; fi

# 4) 私有入口（机器无关，来自 .local/android-build.env，不提交 Git）。
# shellcheck disable=SC1091
source "$ROOT/.local/android-build.env"
: "${NAS_ORIGIN:?缺少 NAS_ORIGIN，请检查 .local/android-build.env}"
: "${DIRECT_URL:?缺少 DIRECT_URL，请检查 .local/android-build.env}"

# 5) 调试签名：同一把 key（.local/debug.keystore），密码/别名是 Android 调试 key 公开默认值。
KEYSTORE="$ROOT/.local/debug.keystore"
[ -f "$KEYSTORE" ] || { echo "缺少调试签名 key：$KEYSTORE"; exit 1; }

cd "$ROOT/android"
./gradlew --project-cache-dir ../.local/android-gradle-cache \
  -PnasOrigin="$NAS_ORIGIN" \
  -PdirectUrl="$DIRECT_URL" \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password=android \
  -Pandroid.injected.signing.key.alias=androiddebugkey \
  -Pandroid.injected.signing.key.password=android \
  :app:assembleDebug :app:lintDebug

# 6) 唯一文件名交付，不覆盖历史下载。
VERSION="$(grep -oE "versionName '[0-9.]+'" "$ROOT/android/app/build.gradle" | head -1 | cut -d"'" -f2)"
cp -n "$ROOT/.local/android-build/app/outputs/apk/debug/app-debug.apk" \
  "$ROOT/.local/dsh-$VERSION-$(date +%Y%m%d-%H%M%S)-debug.apk"
echo "APK 已生成：$ROOT/.local/dsh-$VERSION-*-debug.apk"
