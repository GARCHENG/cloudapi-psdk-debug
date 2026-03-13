# UI Language Switching

## Purpose
Ensure the renderer can toggle between Chinese and English experiences while keeping MQTT identifiers and diagnostics stable, and reflecting the privacy and content requirements described in the delta spec.

## ADDED Requirements

### Requirement: Renderer MUST 鎻愪緵鏄惧紡鐨勪腑鑻辫瑷€鍒囨崲骞舵寔涔呭寲鐢ㄦ埛閫夋嫨
绯荤粺 MUST 鍦ㄩ《灞?renderer 鐣岄潰鎻愪緵鍙鐨勮瑷€鍒囨崲鍏ュ彛锛岃嚦灏戞敮鎸?`zh-CN` 涓?`en` 涓ょ閫夋嫨銆傜敤鎴峰垏鎹㈣瑷€鍚庯紝鎵€鏈夊凡鎸傝浇鐨勬湰鍦板寲鐣岄潰鍐呭 MUST 绔嬪嵆鏇存柊锛屽苟灏嗚鍋忓ソ鎸佷箙鍖栧埌 renderer 鍙鐨勬湰鍦板瓨鍌ㄤ腑锛屼互渚垮悗缁埛鏂版垨閲嶆柊鎵撳紑搴旂敤鏃舵仮澶嶃€?
#### Scenario: 鐢ㄦ埛鎵嬪姩鍒囨崲鍒颁腑鏂?
- **WHEN** 鐢ㄦ埛鍦ㄤ富鐣岄潰璇█鍒囨崲鍏ュ彛涓€夋嫨 `zh-CN`
- **THEN** 绯荤粺 MUST 鍦ㄥ綋鍓嶄細璇濅腑绔嬪嵆灏嗛〉澶淬€侀潰鏉裤€佹寜閽€佹彁绀哄拰 Modal 鏂囨鍒囨崲涓轰腑鏂?
#### Scenario: 鍒锋柊鍚庢仮澶嶇敤鎴烽€夋嫨
- **WHEN** 鐢ㄦ埛姝ゅ墠宸茬粡灏嗙晫闈㈣瑷€鍒囨崲涓?`en` 鎴?`zh-CN`锛岄殢鍚庡埛鏂伴〉闈㈡垨閲嶆柊鍚姩妗岄潰搴旂敤
- **THEN** 绯荤粺 MUST 浼樺厛鎭㈠璇ュ凡淇濆瓨璇█锛岃€屼笉鏄噸鏂板洖閫€鍒拌繍琛岀幆澧冮粯璁よ瑷€

### Requirement: Renderer MUST 鎸夋棦瀹氫紭鍏堢骇瑙ｆ瀽鍒濆璇█
褰撶敤鎴峰皻鏈繚瀛樿瑷€鍋忓ソ鏃讹紝绯荤粺 MUST 鎸変互涓嬩紭鍏堢骇閫夋嫨鍒濆鐣岄潰璇█锛氶鍏堟鏌ュ凡淇濆瓨鍋忓ソ锛涜嫢涓嶅瓨鍦紝鍒欐鏌ヨ繍琛岀幆澧?locale锛涘綋 locale 浠?`zh` 寮€澶存椂浣跨敤 `zh-CN`锛屽惁鍒欎娇鐢?`en`銆?
#### Scenario: 宸蹭繚瀛樺亸濂戒紭鍏堜簬杩愯鐜 locale
- **WHEN** 鏈湴瀛樺偍涓凡瀛樺湪 `zh-CN` 鎴?`en` 璇█鍋忓ソ锛屼笖杩愯鐜 locale 涓庝箣涓嶅悓
- **THEN** 绯荤粺 MUST 浣跨敤宸蹭繚瀛樺亸濂戒綔涓哄垵濮嬭瑷€

#### Scenario: 涓枃 locale 鑷姩杩涘叆涓枃鐣岄潰
- **WHEN** 鏈湴瀛樺偍涓笉瀛樺湪璇█鍋忓ソ锛屼笖杩愯鐜 locale 涓?`zh-CN`銆乣zh-SG` 鎴栧叾浠?`zh-*`
- **THEN** 绯荤粺 MUST 浠?`zh-CN` 鍒濆鍖栫晫闈?
#### Scenario: 闈炰腑鏂?locale 鍥為€€鑻辨枃
- **WHEN** 鏈湴瀛樺偍涓笉瀛樺湪璇█鍋忓ソ锛屼笖杩愯鐜 locale 涓嶄互 `zh` 寮€澶?
- **THEN** 绯荤粺 MUST 浠?`en` 鍒濆鍖栫晫闈?

### Requirement: 鎵€鏈夐潰鍚戞搷浣滆€呯殑鐣岄潰鏂囨 MUST 闅忓綋鍓嶈瑷€涓€鑷村垏鎹?绯荤粺 MUST 涓烘搷浣滆€呭彲瑙佺殑涓昏 UI 鏂囨鎻愪緵鍙岃鐗堟湰锛岃嚦灏戣鐩栭〉澶磋鏄庛€侀潰鏉挎爣棰樸€佹寜閽€佽〃鍗曟爣绛俱€乸laceholder銆佺┖鎬佹枃妗堛€佺姸鎬佹爣绛俱€佹牎楠屾彁绀恒€佽繍琛屾椂 `window.alert`銆佹棩蹇?Modal 鍜屽簭鍒楁墽琛岃瘖鏂枃妗堛€備笌鍛戒护鐩稿叧鐨勪汉绫诲彲璇绘爣绛惧拰鎾斁杩涘害鏍囩 MUST 璺熼殢褰撳墠璇█鍙樺寲銆?
#### Scenario: 鍒囨崲璇█鍚庝富瑕侀潰鏉挎枃妗堝悓姝ユ洿鏂?
- **WHEN** 鐢ㄦ埛鍦ㄨ繛鎺ラ潰鏉裤€佹帶鍒堕潰鏉裤€佺姸鎬侀潰鏉裤€佸簭鍒楅潰鏉挎垨缁撴灉闈㈡澘鍙鐨勬儏鍐典笅鍒囨崲璇█
- **THEN** 杩欎簺闈㈡澘涓殑鏍囬銆佹寜閽€乸laceholder銆佺┖鎬佸拰璇存槑鏂囨 MUST 鍦ㄥ悓涓€浼氳瘽鍐呭悓姝ユ洿鏂颁负鐩爣璇█

#### Scenario: 杩愯鏃舵彁绀轰娇鐢ㄥ綋鍓嶈瑷€
- **WHEN** 鐢ㄦ埛瑙﹀彂缂哄皯 `Gateway SN`銆佹湭杩炴帴 MQTT銆侀煶棰戞牎楠屽け璐ユ垨鍏朵粬褰撳墠宸叉湁鐨勮繍琛屾椂鎻愮ず
- **THEN** 绯荤粺 MUST 浠ュ綋鍓嶈瑷€鏄剧ず瀵瑰簲 `window.alert` 鎴栨牎楠屽弽棣堟枃妗?
#### Scenario: 鍛戒护鏍囩涓庤繘搴︽爣绛鹃殢璇█鍒囨崲
- **WHEN** 鐢ㄦ埛鍒囨崲鐣岄潰璇█鍚庢煡鐪?`Command Results`銆乣Play Progress` 鎴?`Command Sequence`
- **THEN** 绯荤粺 MUST 灏嗕汉绫诲彲璇荤殑 method label銆佺姸鎬?label 鍜岃繘搴﹁鏄庡垏鎹负鐩爣璇█

### Requirement: 鍘熷璇婃柇鏍囪瘑 MUST 淇濇寔鏈炕璇戜笖鍙拷韪?绯荤粺 MUST 淇濇寔鍗忚绾ц瘖鏂爣璇嗙殑鍘熸牱灞曠ず锛屼笉寰楀 method code銆丮QTT topic銆乣tid`銆乣bid`銆丼N銆丮D5 绛夊師濮嬪€煎仛缈昏瘧鎴栨敼鍐欍€傝嫢鏌愪釜鐣岄潰鍚屾椂灞曠ず浜虹被鍙鏍囩涓庡師濮嬪€硷紝鍒欎袱鑰?MUST 淇濇寔涓€涓€瀵瑰簲銆?
#### Scenario: 璇█鍒囨崲涓嶅奖鍝?method code 涓?TID
- **WHEN** 鐢ㄦ埛鍦ㄤ换鎰忚瑷€涓嬫煡鐪?`Command Results` 鎴?`Command Sequence` 璇︽儏
- **THEN** 绯荤粺 MUST 淇濇寔 method code 涓?`tid` 鐨勫師濮嬪瓧绗︿覆涓嶅彉

#### Scenario: MQTT topic 涓?payload 鍏抽敭瀛楁淇濇寔鍘熸牱
- **WHEN** 鐢ㄦ埛鏌ョ湅涓?MQTT 鐩稿叧鐨?topic 鍚嶇О銆乸ayload 鎽樿銆丼N 鎴?MD5
- **THEN** 绯荤粺 MUST 鏄剧ず鍘熷鎶€鏈€硷紝鑰屼笉鏄湰鍦板寲鍚庣殑鏇夸唬鏂囨湰

### Requirement: 涓枃鐣岄潰 MUST 鎻愪緵閫傞厤涓枃闃呰鐨勬帓鐗堜笌甯冨眬
褰撳綋鍓嶈瑷€涓?`zh-CN` 鏃讹紝绯荤粺 MUST 浠ラ€傚悎涓枃闃呰鐨勬柟寮忓睍绀哄叡浜爣棰樸€佹爣绛俱€乥adge 鍜屾寜閽粍锛屽寘鎷彇娑堝涓枃鏂囨湰鐨勫己鍒?uppercase銆侀檷浣庝笉蹇呰鐨勫瓧璺濇媺浼搞€佸厑璁歌緝闀夸腑鏂囨爣绛炬崲琛岋紝骞跺湪涓嶅奖鍝嶈皟璇曚俊鎭彲璇绘€х殑鍓嶆彁涓嬩繚鎸佷富瑕佸崱鐗囥€佽〃鏍煎拰鎸夐挳鍖哄煙绋冲畾銆?
#### Scenario: 涓枃鏍囬涓庢爣绛句笉浣跨敤鑻辨枃寮忓瓧璺濈瓥鐣?
- **WHEN** 褰撳墠璇█涓?`zh-CN`
- **THEN** 绯荤粺 MUST 璁╅潰鏉挎爣棰樸€佽緟鍔╂爣绛惧拰 badge 閬垮厤鍑虹幇鍙€傜敤浜庤嫳鏂囩缉鍐欑殑 uppercase 涓庤繃瀹?tracking 鏁堟灉

#### Scenario: 涓枃闀挎枃妗堜笉搴旂牬鍧忓叧閿竷灞€
- **WHEN** 涓枃鎸夐挳鏂囨銆侀敊璇彁绀烘垨鍗＄墖鎽樿闀垮害鏄庢樉闀夸簬鑻辨枃
- **THEN** 绯荤粺 MUST 閫氳繃鎹㈣銆佸爢鍙犳垨瀹藉害璋冩暣淇濊瘉鎸夐挳鍙偣鍑汇€佽〃鏍煎彲璇伙紝涓斾笉寰楅伄鎸?`tid`銆丮D5銆乵ethod code 绛夊叧閿瘖鏂俊鎭?

### Requirement: 璇█鍒囨崲 MUST 涓嶆敼鍙?MQTT publish/subscribe 涓?ACK 璇箟
鏃犺褰撳墠鐣岄潰璇█涓轰綍锛岀郴缁?MUST 缁х画浣跨敤鏃㈡湁 MQTT 娑堟伅娴侊細璁㈤槄 `thing/product/{device_sn}/state`銆乣thing/product/{gateway_sn}/events`銆乣thing/product/{gateway_sn}/services_reply`銆乣thing/product/{gateway_sn}/services`锛屽彂甯?`thing/product/{gateway_sn}/services`锛屽苟缁х画渚濇嵁 `services_reply.data.result` 涓庡綋鍓?timeout 鏈哄埗鍒ゅ畾鍛戒护缁撴灉銆?
#### Scenario: 涓嶅悓璇█涓嬪彂甯冨悓涓€鍛戒护
- **WHEN** 鐢ㄦ埛鍒嗗埆鍦?`en` 涓?`zh-CN` 鐣岄潰涓嬪彂閫佸悓涓€鏉?PSDK 鎴?speaker 鍛戒护
- **THEN** 绯荤粺 MUST 鍙戝竷鍒扮浉鍚岀殑 `services` topic锛屽苟淇濇寔鐩稿悓鐨?payload 缁撴瀯

#### Scenario: 涓嶅悓璇█涓嬩繚鎸佺浉鍚屽洖鎵т笌 timeout 琛屼负
- **WHEN** 鐢ㄦ埛鍦ㄤ换涓€璇█鐣岄潰涓嬪彂閫佸懡浠ゅ苟鏀跺埌 `services_reply`锛屾垨鍦?timeout 鏃堕棿鍐呮湭鏀跺埌鍥炴墽
- **THEN** 绯荤粺 MUST 鎸夋棦鏈夎鍒欐洿鏂?pending/success/failure/timeout 鐘舵€侊紝鑰屼笉寰楀洜涓鸿瑷€鍒囨崲鏀瑰彉鍒ゅ畾缁撴灉
