# 卡牌定义 Card

## id

类型：number

解释：卡牌唯一标识（0~1000）

## name

类型：string

解释：卡牌名

## description

类型：string

解释：卡牌描述

## src

类型：string

解释：卡面url

## cost

类型：number

解释：卡牌费用

## costType

类型：number

解释：费用类型 0无色 1水 2火 3雷 4冰 5风 6岩 7草 8同色

## type

类型：number

解释：卡牌主类型 0装备 1支援 2事件

## subType

类型：number[]

解释：卡牌副类型 

0武器 1圣遗物 2场地 3伙伴 4道具 5料理 6天赋 7战斗行动 8秘传 9元素共鸣 

-1减伤 -2复苏料理 -3所属共鸣 -4免击倒 -5不能调和

## userType

类型：number

解释：与卡牌使用角色类型匹配

0全匹配 weaponType匹配武器 HeroId匹配天赋

## useCnt

类型：number

解释：累积的点数，大于等于零时显示在装备右下角

## perCnt

类型：number

解释：每回合可用次数

## energy

类型：number

解释：需要的充能

## anydice

类型：number

解释：当cost为某种元素骰时，除了元素骰以外需要的任意骰

## handle

类型：(card: Card, event?: CardHandleEvent) => CardHandleRes

解释：卡牌发动的效果函数

## canSelectHero

类型：number

解释：卡牌能选择角色的数量

## canSelectSummon

类型：number

解释：能选择的召唤物 -1不能选择 0能选择敌方 1能选择我方

## canSelectSite

类型：number

解释：能选择的支援物 -1不能选择 0能选择敌方 1能选择我方

## explains

类型：ExplainContent[]

解释：描述中提到的其他名词的解释

# 创建一个卡牌

## 构造函数

```typescript
constructor(
  id: number,
  name: string,
  description: string, 
  src: string, 
  cost: number, 
  costType: number, 
  type: number, 
  subType: number[],
  userType: number, 
  canSelectHero: number, 
  handle?: (card: Card, event: CardHandleEvent) => CardHandleRes,
  options: {
    uct?: number, 
    pct?: number, 
    expl?: ExplainContent[], 
    energy?: number, 
    anydice?: number, 
    canSelectSummon?: number,
    canSelectSite?: number,
    isResetUct?: boolean, 
    isResetPct?: boolean, 
    spReset?: boolean, 
  } = {}
)
```

### handle 效果函数

#### card

类型：Card

解释：被作用的卡牌

#### CardHandleEvent

##### heros

类型：Hero[]

解释：我方所有角色

##### eheros

类型：Hero[]

解释：敌方所有角色

##### hidxs

类型：number[]

解释：使用卡时目标角色的序号（从0开始）

##### reset

类型：boolean

解释：开始阶段重置的标记，如果有特殊重置逻辑可以使用，perCnt和useCnt会自动根据配置重置，不用写在此处

##### hcard

类型：Card

解释：装备对该卡的减骰判断

##### trigger

类型：Trigger

解释：触发的事件名

##### summons

类型：Summonee[]

解释：我方所有召唤物

##### esummons

类型：Summonee[]

解释：敌方所有召唤物

##### changeHeroDiceCnt

类型：number

解释：当前切换角色所需要的骰子数

##### hcardsCnt

类型：number

解释：我方手牌数

##### ehcardsCnt

类型：number

解释：敌方手牌数

##### heal

类型：number[]

解释：本次我方各个角色回血数量

##### dicesCnt

类型：number

解释：我方骰子数

##### ephase

类型：number

解释：敌方所处的阶段

##### isChargedAtk

类型：boolean

解释：是否为重击

##### isFallAtk

类型：boolean

解释：是否为下落攻击

##### round

类型：number

解释：当前回合数

##### playerInfo

类型：GameInfo

解释：一些游戏信息，详见类型

##### restDmg

类型：number

解释：剩余的伤害数，用于抵挡伤害的卡牌，需将新的剩余伤害数返回

##### isSkill

类型：number

解释：是否为角色使用技能，-1为不是，否则为使用的技能的序号（从0开始）

##### isExec

类型：boolean

解释：是否为真正的执行（有时可能是技能的预览伤害）

##### site

类型：Site[]

解释：我方所有支援物

##### esite

类型：Site[]

解释：敌方所有支援物

##### minusDiceCard

类型：number

解释：当前的卡牌花费，用于有减骰效果的卡牌

##### ehidx

类型：number

解释：被攻击的角色序号（从0开始）

##### minusDiceSkill

类型：number[][]

解释：当前各个技能的花费，用于有减技能骰效果的卡牌

##### getdmg

类型：number[]

解释：本次我方角色受到的伤害数，一般是配合"other-getdmg"使用

#### CardHandleRes

##### site

类型：Site[]

解释：生成支援物

##### cmds

类型：Cmds[]

解释：使用卡时执行的命令

##### execmds

类型：Cmds[]

解释：触发事件时执行的命令

##### trigger

类型：Trigger[]

解释：会触发卡（装备）的事件名

##### inStatus

类型：Status[]

解释：我方附属角色状态

##### outStatus

类型：Status[]

解释：我方生成出战状态

##### inStatusOppo

类型：Status[]

解释：敌方附属角色状态

##### outStatusOppo

类型：Status[]

解释：敌方生成出战状态

##### canSelectHero

类型：boolean[]

解释：角色是否可选择（长度与heros对应）

##### summon

类型：Summonee[]

解释：我方召唤召唤物

##### addDmg

类型：number

解释：所有伤害增加

##### addDmgType1

类型：number

解释：普通攻击伤害增加

##### addDmgType2

类型：number

解释：元素战技伤害增加

##### addDmgType3

类型：number

解释：元素爆发伤害增加

##### addDmgCdt

类型：number

解释：满足触发事件条件增伤

##### minusDiceCard

类型：number

解释：对卡牌的减骰

##### minusDiceHero

类型：number

解释：切换角色的减骰

##### hidxs

类型：number[]

解释：用于配合inStatus和inStatusOppo分配角色状态

##### isValid

类型：boolean

解释：出牌是否合法，可能要满足某些条件

##### element

类型：number

解释：骰子元素，配合cnt和phase-dice表示改变的元素骰

##### cnt

类型：number

解释：骰子个数，配合element和phase-dice表示改变的元素骰

##### isDestroy

类型：boolean

解释：使用某装备后，是否会立即弃置

##### restDmg

类型：number

解释：减伤过后新的受伤害数

##### isNotAddTask

类型：boolean

解释：是否不加入任务队列，不加入的话就不会有闪光动画，直接执行效果

##### exec

类型：() => CardExecRes

解释：执行时的函数

#### CardExecRes

##### inStatus

类型：Status[]

解释：我方附属角色状态

##### outStatus

类型：Status[]

解释：我方生成出战状态

##### inStatusOppo

类型：Status[]

解释：敌方附属角色状态

##### outStatusOppo

类型：Status[]

解释：敌方生成出战状态

##### hidxs

类型：number[]

解释：用于配合inStatus和inStatusOppo分配角色状态

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

### options 配置项

#### uct

解释：useCnt

默认值：-1

#### pct

解释：perCnt

默认值：0

#### expl

解释：explains

默认值：[]

#### energy

默认值：0

#### anydice

默认值：0

#### canSelectSummon

默认值：-1

#### canSelectSite

默认值：-1

#### isResetUct

解释：每回合是否重置useCnt

默认值：false

#### isResetPct

解释：每回合是否重置perCnt

默认值：true

#### spReset

解释：是否有特殊重置逻辑

默认值：false


# 角色定义 Hero

## id

类型：number

解释：角色唯一标识（1000~2000）

## name

类型：srting

解释：角色名字

## local

类型：number[]

解释：所属标签 0魔物 1蒙德 2璃月 3稻妻 4须弥 5枫丹 6纳塔 7至冬 8愚人众 9丘丘人 10镀金旅团 11始基力:荒性 12始基力:芒性

## maxhp

类型：number

解释：最大生命值

## hp

类型：number

解释：当前生命值

## element

类型：number

解释：角色元素类型 0物理 1水 2火 3雷 4冰 5风 6岩 7草

## weaponType

类型：number

解释：角色武器类型 0其他武器 1单手剑 2双手剑 3弓 4法器 5长柄

## maxEnergy

类型：number

解释：角色所需充能

## energy

类型：number

解释：角色当前充能

## src

类型：string

解释：角色立绘链接

## skills

类型：Skill[]

解释：角色技能

## weaponSlot

类型：Card

解释：武器栏

## artifactSlot

类型：Card

解释：圣遗物栏

## talentSlot

类型：Card

解释：天赋栏

## inStatus

类型：Status[]

解释：角色状态

## outStatus

类型：Status[]

解释：出战状态

## isFront

类型：boolean

解释：是否为出战角色

## attachElement

类型：number[]

解释：附着元素 1水 2火 3雷 4冰 7草

# 创建一个角色

## 构造函数

```typescript
constructor(
  id: number, 
  name: string, 
  local: number | number[],
  maxhp: number,
  element: number, 
  weaponType: number,
  src: string | string[],
  skill1?: ((costElement: number, weaponType2: number) => Skill) | null,
  skills: Skill[] = [],
)
```


# 技能定义 Skill

## name

类型：string

解释：技能名

## description

类型：string

解释：技能描述

## type

类型：number

解释：技能类型 1普通攻击 2元素战技 3元素爆发 4被动技能

## damage

类型：number

解释：技能伤害

## dmgElement

类型：number

解释：造成伤害的元素 0物理 1水 2火 3雷 4冰 5风 6岩 7草

## cost

类型：{ val: number, color: number }[]

解释：技能花费 [元素骰, 任意骰, 充能]

val为花费数量，color为花费颜色

## attachElement

类型：number

解释：附魔元素

## src

类型：string

解释：技能图标url

## handle

类型：(event: SkillHandleEvent) => SkillHandleRes

解释：技能发动的效果函数

## useCnt

类型：number

解释：本回合技能已使用次数

## isUsed

类型：boolean

解释：本场游戏是否使用过该技能

## explains

类型：ExplainContent[]

解释：描述中提到的其他名词的解释

# 创建一个技能

## 构造函数

```typescript
constructor(
  name: string, 
  description: string, 
  type: number, 
  damage: number, 
  cost: number,
  costElement: number, 
  options: { 
    ac?: number, 
    ec?: number, 
    de?: number, 
    rdskidx?: number 
  } = {},
  src?: string | string[], 
  explains?: ExplainContent[], 
  handle?: (hevent: SkillHandleEvent) => SkillHandleRes
)
```

### cost

解释：所需特定元素骰数量

### costElement

解释：所需特定元素

### options 配置项

#### ac

解释：anyCost 技能所需任意骰数量

默认值：0

#### ec

解释：energyCost 技能所需充能

默认值：0

#### de

解释：dmgElement 造成伤害的元素

默认值：costElement

#### rdskidx

解释：readySkillIdx 准备技能的序号

默认值：-1

### handle 效果函数

#### SkillHandleEvent

##### hero

类型：Hero

解释：使用该技能的角色

##### skidx

类型：number

解释：在技能组中的序号

##### reset

类型：boolean

解释：开始阶段重置的标记，如果有特殊重置逻辑可以使用

##### card

类型：Card

解释：卡所使用的技能

##### heros

类型：Hero[]

解释：我方所有角色

##### eheros

类型：Hero[]

解释：敌方所有角色

##### hcard

类型：Card[]

解释：我方手牌

##### summons

类型：Summonee[]

解释：我方召唤物

##### isChargedAtk

类型：boolean

解释：是否为重击

##### isFallAtk

类型：boolean

解释：是否为下落攻击

##### isReadySkill

类型：boolean

解释：是否为准备技能

##### isExec

类型：boolean

解释：是否为真正的执行（有时可能是技能的预览伤害）

##### getdmg

类型：number

解释：本次该角色受到的伤害

##### windEl

类型：number

解释：形成扩散反应的元素

##### trigger

类型：Trigger

解释：触发的事件名

##### minusDiceSkill

类型：number[][]

解释：当前各个技能的花费，用于有减技能骰效果的卡牌

##### heal

类型：number[]

解释：本次我方各个角色回血数量

#### SkillHandleRes

##### inStatus

类型：Status[]

解释：我方附属角色状态

##### outStatus

类型：Status[]

解释：我方生成出战状态

##### inStatusOppo

类型：Status[]

解释：敌方附属角色状态

##### outStatusOppo

类型：Status[]

解释：敌方生成出战状态

##### summon

类型：Summonee[]

解释：我方召唤召唤物

##### trigger

类型：Trigger[]

解释：会触发技能的事件名

##### isAttach

类型：boolean

解释：是否有给自身的元素附着

##### pendamage

类型：number

解释：对敌方造成的穿透伤害

##### pendamageSelf

类型：number

解释：对自己造成的穿透伤害

##### addDmgCdt

类型：number

解释：满足触发事件条件增伤

##### isQuickAction

类型：boolean

解释：是否为快速行动

##### inStatusPre

类型：Status[]

解释：我方附属角色状态（此状态在当前技能中就会生效）

##### outStatusPre

类型：Status[]

解释：我方生成出战状态（此状态在当前技能中就会生效）

##### inStatusOppoPre

类型：Status[]

解释：敌方附属角色状态（此状态在当前技能中就会生效）

##### outStatusOppoPre

类型：Status[]

解释：敌方生成出战状态（此状态在当前技能中就会生效）

##### summonPre

类型：Summonee[]

解释：我方召唤召唤物（提前召唤，用于召唤物伤害元素的转换）

##### cmds

类型：Cmds[]

解释：使用技能时执行的命令

##### heal

类型：number

解释：使用技能回血

##### hidxs

类型：number[]

解释：配合heal/pendamage作用的目标角色的序号（从0开始），若不写则为出战角色

##### handCards

类型：Card[]

解释：我方手牌

##### atkBefore

类型：boolean

解释：攻击敌方上一个后台角色

##### atkAfter

类型：boolean

解释：攻击敌方下一个后台角色

##### atkTo

类型：number

解释：攻击敌方指定序号角色（从0开始）

##### exec

类型：() => void

解释：执行时的函数


# 状态定义 Status

## id

类型：number

解释：唯一id（2000~3000）

## name

类型：string

解释：状态名

## description

类型：string

解释：状态描述

## icon

类型：string

解释：状态图标

## group

类型：number

解释：状态属性 0角色状态 1出战状态

## type

类型：number

解释：状态类型  

0隐藏 1攻击 2挡伤 3回合 4使用 5翻倍伤害 6条件加伤 7护盾 8元素附魔 9累积 10标记 11准备技能 12死后不删除 13免击倒 14无法行动 15暂时不消失 16条件附魔

## useCnt

类型：number

解释：剩余使用次数

## maxCnt

类型：number

解释：最多叠加次数 0为不能叠加

## addCnt

类型：number

解释：叠加时增加的次数（一般addCnt等于useCnt）

## perCnt

类型：number

解释：每回合可用次数

## roundCnt

类型：number

解释：剩余轮次数 -1为无轮次限制

## isTalent

类型：boolean

解释：是否为装备天赋后生成的状态

## handle

类型：(status: Status, event: StatusHandleEvent) => StatusHandleRes

解释：状态发动的效果函数

## summonId

类型：number

解释：召唤物的id，表示由召唤物衍生出的状态 -1不存在

## iconBg

类型：string

解释：图标背景色

## explains

类型：ExplainContent[]

解释：描述中提到的其他名词的解释

## addition

类型：any[]

解释：一些额外的信息

# 创建一个状态

## 构造函数

```typescript
constructor(
  id: number, 
  name: string, 
  description: string, 
  icon: string, 
  group: number, 
  type: number[],
  useCnt: number, 
  maxCnt: number, 
  roundCnt: number, 
  handle?: (status: Status, event?: StatusHandleEvent) => StatusHandleRes,
  options: {
    smnId?: number, 
    pct?: number,
    icbg?: string, 
    expl?: ExplainContent[], 
    act?: number,
    isTalent?: boolean, 
    isReset?: boolean, 
    add?: any[]
  } = {}
)
```

### handle 效果函数

#### status

类型：Status

解释：被作用的状态

#### StatusHandleEvent

##### restDmg

类型：number

解释：剩余的伤害数，用于抵挡伤害的卡牌，需将新的剩余伤害数返回

##### summon

类型：Summonee

解释：由召唤物衍生出的状态会使用此变量同步召唤物状态

##### hidx

类型：number

解释：持有该状态的角色序号（从0开始）

##### heros

类型：Hero[]

解释：我方所有角色

##### eheros

类型：Hero[]

解释：敌方所有角色

##### willAttach

类型：number

解释：受到的元素附着

##### reset

类型：boolean

解释：开始阶段重置的标记，如果有特殊重置逻辑可以使用，perCnt和useCnt会自动根据配置重置，不用写在此处

##### trigger

类型：Trigger

解释：触发的事件名

##### card

类型：Card

解释：装备对该卡的减骰判断

##### isChargedAtk

类型：boolean

解释：是否为重击

##### isFallAtk

类型：boolean

解释：是否为下落攻击

##### phase

类型：number

解释：我方当前阶段

##### skilltype

类型：number

解释：技能类型 1普通攻击 2元素战技 3元素爆发

##### hidxs

类型：number[]

解释：将要切换到的角色（只有一项）

##### isElStatus

类型：boolean[]

解释：受到的具体反应 0绽放反应 1激化反应

##### hasDmg

类型：boolean

解释：使用的技能是否能造成伤害

##### isSkill

类型：number

解释：是否为角色使用技能，-1为不是，否则为使用的技能的序号（从0开始）

##### dmgSource

类型：number

解释：伤害来源的id

##### dmgElement

类型：number

解释：造成伤害的元素

##### minusDiceCard

类型：number

解释：当前的卡牌花费，用于有减骰效果的卡牌

##### minusDiceSkill

类型：number[][]

解释：当前各个技能的花费，用于有减技能骰效果的卡牌

##### heal

类型：number[]

解释：本次我方各个角色回血数量

##### force

类型：boolean

解释：强制执行

##### summons

类型：Summonee[]

解释：我方所有召唤物

##### esummons

类型：Summonee[]

解释：敌方所有召唤物

##### getDmgIdx

类型：number

解释：受到攻击的角色序号（从0开始）

#### StatusHandleRes

##### restDmg

类型：number

解释：减伤过后新的受伤害数

##### damage

类型：number

解释：造成的伤害（配合type=1有效）

##### pendamage

类型：number

解释：造成的穿透伤害（配合type=1有效）

##### element

类型：number

解释：造成伤害的元素（配合type=1有效）

##### trigger

类型：Trigger[]

解释：会触发状态的事件名

##### addDmg

类型：number

解释：我方所有伤害增加

##### addDmgType1

类型：number

解释：我方普通攻击伤害增加

##### addDmgType2

类型：number

解释：我方元素战技伤害增加

##### addDmgType3

类型：number

解释：我方元素爆发伤害增加

##### addDmgCdt

类型：number

解释：满足触发事件条件增伤

##### addDmgSummon

类型：number

解释：仅召唤物增伤

##### getDmg

类型：number

解释：我方受到的增伤

##### minusDiceCard

类型：number

解释：对卡牌的减骰

##### minusDiceHero

类型：number

解释：切换角色的减骰

##### addDiceHero

类型：number

解释：切换角色的增骰

##### heal

类型：number

解释：回血数（配合type=1有效）

##### hidxs

类型：number[]

解释：配合heal/pendamage作用的目标角色的序号（从0开始），若不写则为出战角色

##### isQuickAction

类型：boolean

解释：是否为快速行动

##### isSelf

类型：boolean

解释：是否对自己造成伤害（配合type=1有效）

##### skill

类型：number

解释：准备技能的序号（rdskidx）

##### cmds

类型：Cmds[]

解释：状态发动时执行的命令

##### summon

类型：Summonee[]

解释：我方召唤召唤物

##### isInvalid

类型：boolean

解释：使用卡时是否为不合法

##### onlyOne

类型：boolean

解释：此状态是否只能在某一方场上存在一个

##### attachEl

类型：number

解释：附魔元素

##### isUpdateAttachEl

类型：boolean

解释：是否更新附魔元素

##### atkAfter

类型：boolean

解释：攻击敌方下一个后台角色

##### exec

类型：(eStatus?: Status, event?: StatusExecEvent) => StatusExecRes

解释：执行时的函数 eStatus用于type=1时发动时的status状态

#### StatusExecEvent

##### heros

类型：Hero[]

解释：执行时我方所有角色

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

#### StatusExecRes

##### cmds

类型：Cmds[]

解释：状态发动时执行的命令

##### inStatus

类型：Status[]

解释：我方附属角色状态

##### outStatus

类型：Status[]

解释：我方生成出战状态

##### inStatusOppo

类型：Status[]

解释：敌方附属角色状态

##### outStatusOppo

类型：Status[]

解释：敌方生成出战状态

##### hidxs

类型：number[]

解释：用于配合inStatus和inStatusOppo分配角色状态

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

### options 配置项

#### smnId

解释：summonId

默认值：-1

#### pct

解释：perCnt

默认值：0

#### icbg

解释：iconBg

默认值：''

#### expl

解释：explains

默认值：[]

#### act

解释：addCnt

默认值：useCnt 和 roundCnt 取最大值

#### isTalent

默认值：false

#### isReset

默认值：true

#### add

解释：addition

默认值：[]


# 召唤物定义 Summonee

## id

类型：number

解释：召唤物唯一id（3000~4000）

## name

类型：string

解释：召唤物名字

## description

类型：string

解释：召唤物描述

## src

类型：string

解释：召唤物图片url

## useCnt

类型：number

解释：可用次数

## maxUse

类型：number

解释：最大可叠加次数

## shield

类型：number

解释：挡伤量(<0)/回复量(>0)

## damage

类型：number

解释：伤害量

## pendamage

类型：number

解释：穿透伤害

## element

类型：number

解释：伤害元素 0物理 1水 2火 3雷 4冰 5风 6岩 7草

## isDestroy

类型：number

解释：次数用完后是否销毁 0用完销毁 1用完后回合结束时销毁 2回合结束时强制销毁

## perCnt

类型：number

解释：每回合可用次数

## isTalent

类型：boolean

解释：是否为装备天赋后召唤的召唤物

## statusId

类型：number

解释：可能存在的衍生状态id -1为不存在

## addition

类型：string[]

解释：一些额外的信息

## handle

类型：(summon: Summonee, event: SummonHandleEvent) => SummonHandleRes

解释：召唤物发动的效果函数

# 创建一个召唤物

## 构造函数

```typescript
constructor(
  id: number,
  name: string, 
  description: string, 
  src: string, 
  useCnt: number, 
  maxUse: number,
  shield: number, 
  damage: number, 
  element: number, 
  handle?: (summon: Summonee, event: SummonHandleEvent) => SummonHandleRes,
  options: { 
pct?: number,
isTalent?: boolean, 
adt?: string[], 
pdmg?: number, 
isDestroy?: number, 
stsId?: number, 
spReset?: boolean 
  } = {}
)
```

### handle 效果函数

#### summon

类型：Summonee

解释：被作用的召唤物

#### SummonHandleEvent

##### trigger

类型：Trigger

解释：触发的事件名

##### heros

类型：Hero[]

解释：我方所有角色

##### eheros

类型：Hero[]

解释：敌方所有角色

##### hidx

类型：number

解释：当前出战角色序号（从0开始）

##### reset

类型：boolean

解释：开始阶段重置的标记，如果有特殊重置逻辑可以使用，perCnt和useCnt会自动根据配置重置，不用写在此处

##### isChargedAtk

类型：boolean

解释：是否为重击

##### isFallAtk

类型：boolean

解释：是否为下落攻击

##### hcard

类型：Card

解释：使用的卡

##### isExec

类型：boolean

解释：是否为真正的执行（有时可能是预览）

##### isSkill

类型：number

解释：是否为角色使用技能，-1为不是，否则为使用的技能的序号（从0开始）

##### minusDiceCard

类型：number

解释：当前的卡牌花费，用于有减骰效果的卡牌

##### minusDiceSkill

类型：number[][]

解释：当前各个技能的花费，用于有减技能骰效果的卡牌

##### tround

类型：number

解释：当前触发轮次，默认为0

#### SummonHandleRes

##### trigger

类型：Trigger[]

解释：会触发召唤物的事件名

##### cmds

类型：Cmds[]

解释：召唤物发动时执行的命令

##### addDmg

类型：number

解释：所有伤害增加

##### addDmgType1

类型：number

解释：普通攻击伤害增加

##### addDmgType2

类型：number

解释：元素战技伤害增加

##### addDmgType3

类型：number

解释：元素爆发伤害增加

##### addDmgCdt

类型：number

解释：满足触发事件条件增伤

##### rOutStatus

类型：Status[]

解释：每回合重置生成的出战状态

##### isNotAddTask

类型：boolean

解释：是否不加入任务队列，不加入的话就不会有闪光动画，直接执行效果

##### damage

类型：number

解释：造成的伤害

##### element

类型：number

解释：造成伤害的元素

##### addDiceHero

类型：number

解释：切换角色的增骰

##### minusDiceCard

类型：number

解释：对卡牌的减骰

##### tround

类型：number

解释：下次触发轮次，默认为0

##### exec

类型：(event: SummonExecEvent) => SummonExecRes

解释：执行时的函数

#### SummonExecEvent

##### summon

类型：Summonee

解释：执行时的召唤物

##### heros

类型：Hero[]

解释：执行时我方所有角色

##### eheros

类型：Hero[]

解释：执行时敌方所有角色

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

#### SummonExecRes

##### cmds

类型：Cmds[]

解释：召唤物发动时执行的命令

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

### options 配置项

#### pct

解释：perCnt

默认值：0

#### isTalent

默认值：false

#### adt

解释：addition

默认值：[]

#### pdmg

解释：pendamage

默认值：0

#### isDestroy

默认值：0

#### stsId

解释：statusId

默认值：-1

#### spReset

解释：是否有特殊重置逻辑

默认值：false



# 支援物定义 Site

## id

类型：number

解释：支援物唯一id（4000~5000）

## sid

类型：number

解释：在场支援物随机唯一id

## card

类型：Card

解释：支援物的卡牌信息

## cnt

类型：number

解释：次数（轮次，收集物数量，使用次数）

## perCnt

类型：number

解释：每回合可用次数

## hpCnt

类型：number

解释：回血数

## type

类型：number

解释：类型 1轮次 2收集物 3常驻

## handle

类型：(site: Site, event: SiteHandleEvent) => SiteHandleRes

解释：召唤物发动的效果函数

# 创建一个支援物

## 构造函数

```typescript
constructor(
  id: number, 
  cardId: number, 
  cnt: number, 
  perCnt: number, 
  type: number, 
  handle: (site: Site, event?: SiteHandleEvent) => SiteHandleRes, 
  hpCnt = 0
)
```

### handle 效果函数

#### site

类型：Site

解释：被作用的支援物

#### SiteHandleEvent

##### dices

类型：number[]

解释：我方骰子情况

##### trigger

类型：Trigger

解释：触发的事件名

##### heros

类型：Hero[]

解释：我方所有角色

##### eheros

类型：Hero[]

解释：敌方所有角色

##### reset

类型：boolean

解释：开始阶段重置的标记，如果有特殊重置逻辑可以使用，perCnt和useCnt会自动根据配置重置，不用写在此处

##### card

类型：Card

解释：支援物对该卡的减骰判断

##### hcards

类型：Card[]

解释：我方手牌

##### isFirst

类型：boolean

解释：我方是否为先手牌手

##### hidxs

类型：number[]

解释：出战角色序号（只有一项）

##### playerInfo

类型：GameInfo

解释：一些游戏信息，详见类型

##### isSkill

类型：number

解释：是否为角色使用技能，-1为不是，否则为使用的技能的序号（从0开始）

#### hidx

类型：number

解释：将要切换到的角色序号（从0开始）

##### minusDiceCard

类型：number

解释：当前的卡牌花费，用于有减骰效果的卡牌

##### minusDiceSkill

类型：number[][]

解释：当前各个技能的花费，用于有减技能骰效果的卡牌

##### heal

类型：number[]

解释：本次我方各个角色回血数量

##### getdmg

类型：number[]

解释：本次我方角色受到的伤害数

#### SiteHandleRes

##### trigger

类型：Trigger[]

解释：会触发支援物的事件名

##### exec

类型：(event: SiteExeEvent) => SiteExecRes

解释：执行时的函数

##### minusDiceCard

类型：number

解释：对卡牌的减骰

##### minusDiceHero

类型：number

解释：切换角色的减骰

##### element

类型：number

解释：骰子元素，配合cnt和phase-dice表示改变的元素骰

##### cnt

类型：number

解释：骰子个数，配合element和phase-dice表示改变的元素骰

##### addRollCnt

类型：number

解释：增加投掷阶段的投掷次数

##### isQuickAction

类型：boolean

解释：是否为快速行动

##### isExchange

类型：boolean

解释：是否变换支援物区域

##### siteCnt

类型：number

解释：支援物预览增减cnt，如果cnt+siteCnt<0，则会显示消灭标志

##### isNotAddTask

类型：boolean

解释：是否不加入任务队列，不加入的话就不会有闪光动画，直接执行效果

##### isOrTrigger

类型：boolean

解释：在同一回中是否为只要有一个trigger触发就不再触发

##### isLast

类型：boolean

解释：是否在所有支援物最后才判断

##### summon

类型：Summonee[]

解释：我方召唤召唤物

#### SiteExecEvent

##### changeHeroDiceCnt

类型：number

解释：当前切换角色所需要的骰子数

##### isQuickAction

类型：boolean

解释：是否为快速行动

##### summonDiffCnt

类型：number

解释：触发时消失的召唤物的数量

#### SiteExecRes

##### cmds

类型：Cmds[]

解释：触发事件时执行的命令

##### isDestroy

类型：boolean

解释：是否弃置

##### changeHeroDiceCnt

类型：number

解释：切换角色减骰以后新的需要骰子数

##### outStatus

类型：Status[]

解释：我方生成出战状态

##### summon

类型：Summonee[]

解释：我方召唤召唤物


# 命令 Cmds

### getDice

获得骰子

cnt(number): 获得数量

element(number): 

-3 当前出战角色下一个角色元素 

-2 当前出战角色 

-1 随机不重复 

 0 万能 

1~7 对应元素骰

### getCard

我方摸牌

cnt(number): 摸牌数量

subtype(number|number[]): 随机一张含有该类副类型的牌

card(Card | (Card | number)[] | number): 摸具体某牌或牌的id

hidxs(number[]): 不包含其中的卡id

isOppo(boolean): 是否为敌方摸牌

### getEnergy

获得充能

cnt(number): 充能点数

hidxs(number[]): 如果没有则为当前出战角色，否则为数组中idx

isOppo(boolean): 是否为敌人变化充能

### heal

回血

cnt(number): 回血数

hidxs(number[]): 如果没有则为当前出战角色，否则为数组中idx

isAttach(boolean): 是否给我方附着元素

### getStatus

获得我方角色状态或出战状态

inStatus(Status[]): 角色状态或出战状态数组

hidxs(number[]): 如果没有则为当前出战角色，否则为数组中idx

isOppo(boolean): 是否为敌方获得状态

### reroll

重投骰子

cnt(number): 重投数

### revive

复苏我方角色

cnt(number): 复苏后血量

hidxs(number[]): 如果没有则为当前选中角色，否则为数组中idx

### switch-to

我方切换指定角色

hidxs(number[]): 要切换的角色idx

isOppo(boolean): 是否为敌方切换

### switch-before

我方切换为前一个角色

cnt(number): 延迟发动时间（ms）

isOppo(boolean): 是否为敌方切换

### switch-after

我方切换为后一个角色

cnt(number): 延迟发动时间（ms）

isOppo(boolean): 是否为敌方切换

### attach

附着元素

hidxs(number[]): 为数组中idx附着

element(number|number[]): 若为数字则所有附着同样元素，若为数组则分别附着

-1当前出战角色元素 

1~7对应元素类型

### attack

发动攻击

cnt(number): 伤害数

### changeDice

转换所有元素骰

element(number): 0万能 1~7对应元素类型

### changeCard

替换手牌

cnt(number): 延迟替换时间（ms）

### changeElement

转换元素类型（用于风元素召唤物）

element(number): 要转换元素

### changePattern

转换形态

cnt(number): 转换后的hid

### useSkill

使用技能（一般为天赋的战斗行动）

cnt(number): 技能idx-1

### getSkill

获得技能

cnt(number): readySkill中的id

hidxs(number[]): 插入的技能槽skillx

### addCard

将额外的牌均匀置入弃牌堆

cnt(number): 增加的牌数量

card(Card | (Card | number)[] | number): 具体某牌或牌的id

hidxs(number[]): 在牌堆某范围，正数为牌堆顶x，负数为牌堆底，若没有则为全范围

element(number): 1为均匀，否则为随机

### discard

将牌弃置

element(number): 

0 弃置花费最高的手牌 

1 弃置牌堆顶的牌 

2 弃置牌库中随机一张牌


# 触发时机 Trigger

### phase-start

回合开始阶段

### phase-end

回合结束阶段

### phase-dice

投掷阶段

### game-start

游戏开始时

### action-start

我方选择行动前

### action-after

我方进行任意行动后

### end-phase

我方结束回合时

### any-end-phase

任意一方结束回合时

### skill

我方使用技能

### after-skill

我方使用技能后(对新上的状态有效)

### skilltype1

我方使用普通攻击

### skilltype2

我方使用元素战技

### skilltype3

我方使用元素爆发

### after-skilltype1

我方使用普通攻击后(对新上的状态有效)

### after-skilltype2

我方使用元素战技后(对新上的状态有效)

### after-skilltype3

我方使用元素爆发后(对新上的状态有效)

### other-skill

其他我方角色使用技能

### other-skilltype1

其他我方角色使用普通攻击

### other-skilltype2

其他我方角色使用元素战技

### other-skilltype3

其他我方角色使用元素爆发

### oppo-skill

敌方角色使用技能

### change

我方切换角色

### change-to

我方切换角色到某角色

### change-from

我方从某角色切换角色

### change-oppo

敌方切换角色

### card

我方使用卡

### ecard

敌方使用卡

### elReaction

我方造成元素反应

#### el{x}Reaction

x取值为1~7 对应造成具体的元素反应

##### other-el{x}Reaction

其他我方对应造成具体的元素反应

#### el5Reaction:{x}

x取值为1~4 对应造成具体的扩散反应

#### el6Reaction:{x}

x取值为1~4 对应造成具体的结晶反应

#### other-elReaction

其他我方造成元素反应

### get-elReaction

我方受到元素反应

#### get-el{x}Reaction

x取值为1~7 对应受到具体的元素反应

### get-elReaction-oppo

敌方受到元素反应

### kill

我方击倒敌方

### killed

我方被敌方击倒

### will-killed

我方将要被敌方击倒（用于有“免击倒”的状态）

### dmg

我方造成伤害

#### pen-dmg

我方造成穿透伤害

#### {x}-dmg

x取值为 any | water | fire | thunder | ice | wind | rock | grass 对应造成具体的伤害

#### {x}-dmg-wind

x取值为 water | fire | thunder | ice  对应造成具体的扩散元素伤害

### el-dmg

我方造成元素伤害

### getdmg

我方受到伤害

#### pen-getdmg

我方受到穿透伤害

#### other-getdmg

我方其他角色受到伤害

#### {x}-getdmg

x取值为 any | water | fire | thunder | ice | wind | rock | grass 对应受到具体的伤害

### el-getdmg

我方受到元素伤害

### getdmg-oppo

敌方受到伤害

#### pen-getdmg-oppo

敌方受到穿透伤害

#### {x}-getdmg-oppo

x取值为 any | water | fire | thunder | ice | wind | rock | grass 对应敌方受到具体的伤害

### el-getdmg-oppo

敌方受到元素伤害

### heal

我方回血

### revive

我方角色复苏

### useReadySkill

使用准备技能

### status-destroy

状态效果被移除

### summon-destroy

召唤物消失

### slot-destroy

装备被弃置

### site-destroy

支援被弃置

### calc

计算减骰子

### reconcile

进行调和

### discard

弃牌


# 文本解释 ExplainContent

类型：Skill | Status | Summonee | Card

# 游戏信息 GameInfo

## artifactCnt

类型：number

解释：初始牌堆圣遗物数量

## artifactTypeCnt

类型：number

解释：初始牌堆圣遗物种类

## weaponCnt

类型：number

解释：初始牌堆武器数量

## weaponTypeCnt

类型：number

解释：初始牌堆武器种类

## talentCnt

类型：number

解释：初始牌堆天赋数量

## talentTypeCnt

类型：number

解释：初始牌堆天赋种类

## usedCardIds

类型：number[]

解释：使用过的牌的id

## destroyedSite

类型：number

解释：我方被弃置的支援牌数量

## oppoGetElDmgType

类型：number

解释：敌方受到元素伤害的种类(用位计数)