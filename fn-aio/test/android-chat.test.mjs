import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../android/app/src/main/', import.meta.url);
test('文字图片聊天提供独立入口、多图草稿及认证 DSH RPC', async () => {
  const manifest = await readFile(new URL('AndroidManifest.xml', root), 'utf8');
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  assert.doesNotMatch(manifest, /android.permission.RECORD_AUDIO/);
  assert.match(manifest, /android:name="\.VoiceChatActivity"[^>]*android:exported="true"[^>]*android:launchMode="singleTask"[^>]*android:taskAffinity="top\.fnaio\.direct\.voice"/);
  for (const endpoint of ['session/list', 'session/state', 'session/prompt', 'session/wait']) assert.ok(code.includes(endpoint), endpoint);
  assert.doesNotMatch(code, /session\/page|refreshHistory/);
  assert.match(code, /"voice-history:"\+base\+":"\+id/);
  assert.match(code, /"afterSeq",fromSeq,"timeoutMs",20_000,"maxMessages",1/);
  assert.match(code, /rpc\("session\/list",json\("_request",new JSONObject\(\)\)/);
  assert.match(code, /json\("request",json\("sessionId",id\)/);
  for (const action of ['拍照', '图片', '选择会话 ▾']) assert.ok(code.includes(action), action);
  assert.match(code, /private void showSessionPicker\(String\[\] titles,String\[\] ids\)/);
  assert.match(code, /选择要继续记录的对话/);



  assert.match(code, /getCookie\(url\)/);
  assert.match(code, /setInstanceFollowRedirects\(false\)/);

  assert.match(code, /MAX_PENDING_IMAGES=6/);
  assert.match(code, /Intent\.EXTRA_ALLOW_MULTIPLE,true/);
  assert.match(code, /pendingImages\.remove\(index\)/);
  assert.match(code, /TextView remove=label\("×"/);
  assert.match(code, /sendPrompt\(s,new ArrayList<>\(pendingImages\),new ArrayList<>\(pendingFiles\)\)/);


  assert.match(code, /"images",thumbs/);
  assert.match(code, /android\.webkit\.CookieManager/);
});

test('聊天页本地先开、持久补收、严格游标与生命周期隔离', async () => {
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  const create = code.slice(code.indexOf('@Override public void onCreate'), code.indexOf('private int dp'));
  assert.match(create, /else loadLocalMessages\(\)/);
  assert.doesNotMatch(create, /readCursor|session\/state|session\/wait/);
  assert.doesNotMatch(code, /optLong\("cursor",-1\)|lastSeq|session\/page/);
  assert.match(code, /VoiceReplyPolicy\.cursor\(state\.opt\("cursor"\)\)/);
  assert.match(code, /VoiceReplyPolicy\.eligible\(ev\.optString\("type"\),seq,fromSeq\)/);
  assert.match(code, /VoiceReplyPolicy\.ready/);
  assert.match(code, /putString\(pendingKey\(id\),p\.toString\(\)\)\.commit\(\)[\s\S]*?rpc\("session\/prompt"/);
  assert.match(code, /putString\(historyKey\(id\),boundedHistory\(saved\)\)\.remove\(pendingKey\(id\)\)\.commit/);
  assert.match(code, /onStart\(\)[^\n]*resumePending\(\)/);
  assert.match(code, /onStop\(\)[^\n]*waitGeneration\+\+/);
  assert.match(code, /foreground&&ticket==waitGeneration/);
  assert.match(code, /"voice-pending:"\+base\+":"\+id/);
  assert.match(code, /"session\/wait"\.equals\(method\)\?waits:io/);

});

test('图片只暂存，点击发送后批量提交并在本机消息中展示', async () => {
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  const result = code.slice(code.indexOf('@Override protected void onActivityResult'), code.indexOf('@Override protected void onStart'));
  assert.doesNotMatch(result, /sendPrompt|submitPrompt|session\/prompt/);
  assert.match(result, /getClipData\(\)/);
  assert.match(result, /pendingImages\.addAll\(added\)/);
  assert.match(code, /if\(!s\.isEmpty\(\)\|\|!pendingImages\.isEmpty\(\)\|\|!pendingFiles\.isEmpty\(\)\)/);
  assert.match(code, /for\(byte\[\] image:images\).*content\.put/);
  assert.match(code, /for\(byte\[\] sent:images\)pendingImages\.remove\(sent\)/);
  assert.match(code, /entry\.optJSONArray\("images"\)/);
  assert.match(code, /"images",p\.optJSONArray\("images"\)/);
  assert.match(code, /image\.setImageBitmap\(bitmap\)/);
  assert.match(code, /inJustDecodeBounds=true/);
  assert.match(code, /imageIo\.execute/);
  assert.match(code, /importing>0/);
  assert.match(code, /onSaveInstanceState/);
  assert.match(code, /restoreDraft\(state\)/);
  assert.doesNotMatch(code, /SpeechRecognizer|MediaRecorder|TextToSpeech/);
});


test('拍照返回不弹确认框，移除图片使用小视觉与独立触控区域', async () => {
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  const result = code.slice(code.indexOf('@Override protected void onActivityResult'), code.indexOf('@Override protected void onStart'));
  assert.doesNotMatch(result, /AlertDialog|照片已加入草稿|setPositiveButton/);
  assert.match(code, /target\.addView\(remove,new FrameLayout\.LayoutParams\(dp\(22\),dp\(22\)/);
  assert.match(code, /tile\.addView\(removeTarget\(/);
  assert.match(code, /target\.setOnClickListener/);
});


test('文件选择先进入草稿，发送时流式上传并引用收据', async () => {
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  const manifest = await readFile(new URL('AndroidManifest.xml', root), 'utf8');
  const pick = code.slice(code.indexOf('private void handlePickedFiles'), code.indexOf('private boolean canAddImage'));
  assert.doesNotMatch(pick, /uploadFile\(|session\/prompt|sendPrompt/);
  assert.match(code, /ACTION_OPEN_DOCUMENT/);
  assert.match(code, /Intent\.EXTRA_ALLOW_MULTIPLE,true/);
  assert.match(code, /MAX_PENDING_FILES=6/);
  assert.match(code, /MAX_FILE_BYTES=64L\*1024\*1024/);
  assert.match(code, /File\.createTempFile\("chat-file-",".bin"/);
  assert.match(code, /api\/session\/uploadFileBinary/);
  assert.match(code, /appendQueryParameter\("sessionId",id\)/);
  assert.match(code, /appendQueryParameter\("name",file\.name\)/);
  assert.match(code, /setRequestProperty\("Content-Type","application\/octet-stream"\)/);
  assert.match(code, /setFixedLengthStreamingMode\(file\.bytes\)/);
  assert.match(code, /getCookie\(url\.toString\(\)\)/);
  assert.match(code, /String receipt=uploaded\.optString\("receiptId",""\)/);
  assert.match(code, /parts\.put\(json\("type","file","receiptId",receipt\)\)/);
  assert.match(code, /uploadFilesAndSubmit/);
  assert.match(code, /"files",p\.optJSONArray\("files"\)/);
  assert.match(code, /fileRow\(file\.optString\("name"/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});


test('接收消息使用原生 Markdown 渲染且用户消息保持原文', async () => {
  const code = await readFile(new URL('java/top/fnaio/direct/VoiceChatActivity.java', root), 'utf8');
  const renderer = await readFile(new URL('java/top/fnaio/direct/ChatMarkdownRenderer.java', root), 'utf8');
  assert.match(code, /if\(mine\)\{TextView t=label\(value,16,INK\)/);
  assert.match(code, /else ChatMarkdownRenderer\.render\(this,bubble,value,INK,MUTED,TEAL,maxWidth-dp\(24\)\)/);
  for (const feature of ['HEADING', 'LIST', 'RULE', 'TABLE_SEPARATOR', 'addCode', 'addQuote', 'addListItem', 'StyleSpan', 'TypefaceSpan', 'StrikethroughSpan', 'ClickableSpan', 'LinkMovementMethod']) assert.ok(renderer.includes(feature), feature);
  assert.match(renderer, /safeUrl\(String value\)/);
  assert.match(renderer, /"http"\.equalsIgnoreCase\(scheme\)\|\|"https"\.equalsIgnoreCase\(scheme\)/);
  assert.doesNotMatch(renderer, /Html\.fromHtml|WebView|addJavascriptInterface/);
});
