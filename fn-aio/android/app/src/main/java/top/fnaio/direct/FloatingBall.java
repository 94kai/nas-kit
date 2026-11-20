package top.fnaio.direct;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;

/** A 34dp translucent visual inside a 44dp accessible drag/click target. */
public final class FloatingBall extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private boolean expanded, interacting;
    private int dotCount = 1;
    private LinearGradient gradient;
    public FloatingBall(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        setFocusable(true);
        setAlpha(0.86f);
    }
    private float dp(float value) { return value * getResources().getDisplayMetrics().density; }
    /** 球内点的数量：Agent 的当前导航索引（1 起），工具箱固定 1。 */
    public void setDotCount(int value) { dotCount = Math.max(1, Math.min(value, 99)); invalidate(); }
    @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight); updateGradient();
    }
    private void updateGradient() {
        float x = getWidth() / 2f, y = getHeight() / 2f, radius = dp(17);
        // 颜色固定，不再按 FN ID / 直连切换，避免同一个球出现两种身份色。
        int top = Color.argb(245, 83, 109, 254);
        int bottom = Color.argb(235, 63, 81, 211);
        gradient = new LinearGradient(x, y - radius, x, y + radius, top, bottom, Shader.TileMode.CLAMP);
    }
    public void setExpanded(boolean value) { expanded = value; updateOpacity(); invalidate(); }
    public void setInteracting(boolean value) { interacting = value; updateOpacity(); }
    private void updateOpacity() { animate().alpha(expanded || interacting ? 1f : 0.86f).setDuration(120).start(); }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float x = getWidth() / 2f, y = getHeight() / 2f, radius = dp(17);
        paint.setStyle(Paint.Style.FILL);
        paint.setShadowLayer(dp(3), 0, dp(1), Color.argb(50, 20, 31, 54));
        paint.setShader(gradient);
        canvas.drawCircle(x, y, radius, paint);
        paint.clearShadowLayer(); paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(0.8f)); paint.setColor(Color.argb(180, 255, 255, 255));
        canvas.drawCircle(x, y, radius - dp(0.5f), paint);
        paint.setColor(Color.argb(245, 255, 255, 255));
        if (expanded) {
            paint.setStrokeWidth(dp(1.6f)); paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawLine(x - dp(4), y - dp(4), x + dp(4), y + dp(4), paint);
            canvas.drawLine(x + dp(4), y - dp(4), x - dp(4), y + dp(4), paint);
        } else {
            paint.setStyle(Paint.Style.FILL);
            drawIndexDots(canvas, x, y);
        }
    }
    /** 1–9 个点用点阵，10 以上直接用数字，避免小球里挤成一团。 */
    private void drawIndexDots(Canvas canvas, float x, float y) {
        if (dotCount > 9) {
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            paint.setTextSize(dp(11));
            canvas.drawText(String.valueOf(dotCount), x, y - (paint.ascent() + paint.descent()) / 2f, paint);
            paint.setTextAlign(Paint.Align.LEFT);
            paint.setTypeface(null);
            return;
        }
        int cols = dotCount <= 3 ? dotCount : (dotCount <= 4 ? 2 : 3);
        int rows = (dotCount + cols - 1) / cols;
        float gap = dp(5.2f);
        float radius = dp(dotCount <= 4 ? 1.6f : 1.35f);
        for (int i = 0; i < dotCount; i++) {
            int row = i / cols, col = i % cols;
            int inRow = Math.min(cols, dotCount - row * cols);
            float rowWidth = (inRow - 1) * gap;
            float cx = x - rowWidth / 2f + col * gap;
            float cy = y + (row - (rows - 1) / 2f) * gap;
            canvas.drawCircle(cx, cy, radius, paint);
        }
    }
    @Override public boolean performClick() { return super.performClick(); }
}
