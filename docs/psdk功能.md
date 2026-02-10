## psdk-发送文本框内容

**Topic:** thing/product/*{gateway_sn}*/services

**Direction:** down

**Method:** psdk_input_box_text_set

**Data:**

| Column     | Name              | Type | constraint                            | Description |
| ---------- | ----------------- | ---- | ------------------------------------- | ----------- |
| psdk_index | psdk 负载设备索引 | int  | {"min":0}                             |             |
| value      | 文本内容          | text | {"length":128,"unit_name":"字节 / B"} |             |

**Example:**

```json
{
	"bid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
	"data": {
		"psdk_index": 2,
		"value": "hello world"
	},
	"method": "psdk_input_box_text_set",
	"tid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
	"timestamp": 1689740550047
}
```

**Topic:** thing/product/*{gateway_sn}*/services_reply

**Direction:** up

**Method:** psdk_input_box_text_set

**Data:**

| Column | Name       | Type | constraint | Description |
| ------ | ---------- | ---- | ---------- | ----------- |
| result | 结果返回码 | int  |            |             |

**Example:**

```json
{
	"bid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
	"data": {
		"result": 0
	},
	"tid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
	"timestamp:": 1654070968655,
	"method": "psdk_input_box_text_set"
}
```

## [#](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/psdk.html#psdk-设置控件值)psdk-设置控件值

**Topic:** thing/product/*{gateway_sn}*/services

**Direction:** down

**Method:** psdk_widget_value_set

**Data:**

| Column     | Name              | Type | constraint         | Description                        |
| ---------- | ----------------- | ---- | ------------------ | ---------------------------------- |
| psdk_index | psdk 负载设备索引 | int  | {"min":0}          |                                    |
| index      | 控件编号          | int  | {"min":0,"step":1} |                                    |
| value      | 控件值            | int  | {}                 | 开关、进度等控件值由开发者自行定义 |

**Example:**

```json
{
	"bid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
	"data": {
		"index": 1,
		"psdk_index": 2,
		"value": 60
	},
	"method": "psdk_widget_value_set",
	"tid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
	"timestamp": 1689740550047
}
```

**Topic:** thing/product/*{gateway_sn}*/services_reply

**Direction:** up

**Method:** psdk_widget_value_set

**Data:**

| Column | Name       | Type | constraint | Description |
| ------ | ---------- | ---- | ---------- | ----------- |
| result | 结果返回码 | int  |            |             |

**Example:**

```json
{
	"bid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
	"data": {
		"result": 0
	},
	"tid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
	"timestamp:": 1654070968655,
	"method": "psdk_widget_value_set"
}
```