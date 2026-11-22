export const GUIDES = {
  triage: `初筛准则（打分，满分 100）：
- 主体与瞬间 40：主体是否明确、占画面比例、有无动作/眼神/互动
- 光线 25：光比是否可救、有无死白、逆光是否有层次
- 构图 20：主体位置、干扰物、可裁切空间
- 技术 15：清晰度、噪点、玻璃反光/雾、透视畸变
分档：keep ≥ 65，maybe 45–64，skip < 45。
硬伤直接 skip：主体太小（长边占比 < 15%）、明显失焦、大面积遮挡、同批重复机位、隔着脏玻璃整片雾。
初筛的目的是淘汰，不是全留：把不值得修的找出来并给出原因，值得留的留下；不要为了凑数留片。
每张都要写理由（keep 也要写为什么值得修）；引用画面元素，写「鹿鼻上有草地反光」，不写「画质一般」。
direction 必须可执行（写「压暗右后方枯枝、提亮鹿脸、整体暖一点」）。
裁切：crop.aspect 只按比例取最大区域（1:1 往往就是全宽，主体还是太小）；要让主体占更大比例，用 crop.box 给归一化裁切框 [x0,y0,x1,y1]，例如 [0.255,0.357,0.73,0.673]。
汇报时按原因归类说明淘汰项，不要只挑最值得的几张。`,

  styles: `风格（名字直接传给 grade）：
- natural 自然通透：亮、干净、颜色准，适合大多数动物和风景
- film 暖调胶片：高光偏黄、黑位略灰、有颗粒，适合秋冬、树林、毛皮
- cinema 冷调电影：暗部偏青、高光偏暖、对比强，适合雾、逆光、白虎
- fresh 日系清淡：亮、低饱和、低对比，适合草地、留白多的画面
- golden 金色黄昏：暖橙、高光发金，适合夕阳、逆光毛边
- teal 青橙电影：暗部偏冷、高光偏暖，适合城市、水面、动物特写
- moody 暗调氛围：压暗、降饱和、重暗角，适合氛围照、雨天
- vivid 鲜艳通透：高饱和、通透，适合花、天空、色彩丰富的场景
- soft 柔和人像：低对比、肤色柔和，适合人像、孩子、家庭照
- mono 中性黑白：结构清楚，适合斑马、纹理
- noir 高反差黑白：硬光、剪影、粗糙纹理

一批照片只选一个主风格，单张再微调；不要一批里混多种风格。
用户用文字描述风格（「偏青、暗一点、像老电影」）时，选最接近的风格当底，再用 grade 的 adjust 参数微调：brightness/saturation/contrast 是倍数，tint 是 [r,g,b] 增益，vignette 是增量，sharpen 是倍数。翻译完在回复里说明你用了哪些参数。`,

  local: `局部调整（grade 的 local 数组，最多 8 个，按顺序叠加）：
- 压暗环境保主体：{shape:'radial', cx, cy, rx, ry, invert:true, feather:0.6, adjust:{exposure:-0.6~-1.0}}
- 脸部提亮：{shape:'radial', cx, cy, rx:0.08, ry:0.1, feather:0.6, adjust:{exposure:0.3, clarity:0.2}}
- 压天空：{shape:'linear', x0:0, y0:0, x1:0, y1:0.35, feather:0.6, adjust:{exposure:-0.6}}
- 去色：{shape:'box', box:[x0,y0,x1,y1], feather:0.2, adjust:{saturation:0.7}}
坐标都是 0–1 归一化，相对原图。拿不准时先加 mask_preview:true，出一张红色遮罩图自检。

去污（retouch）：
- 先 {action:'retouch', auto:{enabled:true, sensitivity:0.6}} 只拿点位，不写盘；
- 确认点位后带 items:[{id, spots:[{x,y,r}]}] 再调一次才出图；r 相对短边、建议 0.003–0.008。
- 坐标相对**渲染后的画面**（若这张有裁切，就是裁切后的画框），不是原图。
- 不要把「自动检测」的结果直接落盘，可能误删痣。

外部修图回写（ingest）：
- 在外面做完的图用 {action:'ingest', id, file, set_final:true, note} 回写成一整轮，导出会优先用它。
- 回写前确认长宽比和原图一致，否则返回 warning。

旋转：crop.rotate 支持 -45..45 度（先旋转再裁切）；auto_straighten 暂不支持，需要自己看水平线给出角度。

每轮都带 params（style/adjust/local/crop/width）和 stats（直方图、过曝/死黑/发灰警告），list 里能看到 latest_round。`,

  styles_learn: `从参考图学风格：
- 调用 {action:'style_learn', name:'名字', file:'参考图路径', description:'一句话', adjust?:{...}}。
- 建议先自己看参考图，判断它的“风格”（对比、饱和、冷暖、暗角、锐化），把参数放进 adjust；不传 adjust 时工具会按图片统计自动生成，但会把参考图里的场景色（比如草原的绿）也带进来，只适合当起点。
- 学到的风格有 id，之后 grade 里 style 直接传这个 id；它也会出现在工作台的下拉框里（“学到的风格”分组）。
- style_list 可以列出全部内置 + 自定义风格；style_delete 传 id 可以删。`,

  notes: `批注的处理：
- 用户在 review 阶段给照片写批注，可能只保存（noteState=saved），不代表马上要修。
- 批注可能是提问（「为什么建议修这张？」「这张的问题在哪？」），也可能是修改要求（「压暗背景」「裁成 4:5」）。
- 收到批注时逐条判断：提问就直接回答，不要调 grade；要求改的按批注调参数再出预览；拿不准先问用户。
- 不要把批注一律当成修图命令，也不要顺手把没被要求的照片一起修了。`,

  states: `照片状态：
- keep 保留（会参与修图与导出）
- skip 跳过（不修、不导出，原图保留）
- delete 标删（不修、不导出；用户明确要求时才 purge 原图，不可恢复）
- 初筛只写 triage；用户改过的 decision 不会被初筛覆盖。
导出会打一个 zip 到照片目录的 _export/：修过的只放修后图（修好的/），没修过的放原图（原图/），标删的不进包。`,

  boundaries: `能力边界：
- 能做：裁切、曝光、对比、白平衡、饱和度、五种风格、局部压暗背景/提亮主体、导出。
- 不能做：换天、去人、去掉杂物、生成不存在的细节、AI 修补。遇到这类要求直接说做不到，并给最接近的替代（裁掉、压暗、降饱和）。
- 出图后要真的看一张预览再汇报；没看出来的问题不要编。
- 不要修改用户的照片原文件；输出只写 _graded 目录。`,

  workflow: `推荐流程：
1. status 看项目与进度；没有项目就请用户在工作台选目录。
2. sheet 生成联系表（默认取还没初筛的照片，6 张一张表），用 read_image 看表，按编号顺序判断。
3. update 一次写回 6 条结论（tier/score/reasons/problems/direction/crop）。
4. 拿不准的单张，用 list 找到它的 before 预览路径再看一遍。
5. grade 渲染选中的照片（默认 keep），先出 1280 预览。
6. export 出全尺寸到 <目录>/_graded/。
每轮结束汇报：值得修几张、最值得的三张、以及你实际看到的画面问题。`
};

export function guide(topic) {
  const key = String(topic || 'workflow');
  const text = GUIDES[key];
  if (!text) return { topics: Object.keys(GUIDES), text: '可选主题：' + Object.keys(GUIDES).join(', ') };
  return { topic: key, text };
}
