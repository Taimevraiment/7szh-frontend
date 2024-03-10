/// <reference types="vite/client" />

type RoomList = {
    id: number,
    name: string,
    isStart: boolean,
    playerCnt: number,
    hasPassWord: boolean,
}[]

type PlayerList = {
    id: number,
    name: string,
    rid: number,
    status: number,
}[]

type Player = {
    id: number, // id
    name: string, // 名字
    rid: number, // 所在房间id
    handCards: Card[], // 手牌
    heros: Hero[], // 登场英雄
    pile: Card[], // 摸牌堆
    site: Site[], // 场地卡
    summon: Summonee[], // 召唤物
    dice: number[], // 骰子
    diceSelect: boolean[], // 骰子选择数组
    status: number,
    phase: number,
    info: string, // 右上角提示信息
    willGetCard: Card[], // 即将获得的卡
    pidx: number,
    hidx: number, // 出战角色索引idx
    tarhidx: number, // 受击角色索引idx
    did: number, // 出战卡组id
    canAction: boolean, // 是否可以行动
    isUsedSubType8: boolean, // 是否使用秘传卡
    isOffline: boolean,
    playerInfo: gameInfo,
}

type OriDeck = {
    name: string,
    shareCode: string
}

type Deck = {
    name: string,
    heroIds: number[],
    cardIds: number[],
}

type DeckVO = {
    name: string,
    heroIds: {
        id: number,
        name: string,
        element: number,
        local: number[],
        src: string,
    }[],
    cardIds: number[],
}

type Card = {
    id: number, // 唯一id 从0开始 0xx武器 1xx圣遗物 2xx场地 3xx伙伴 4xx道具 5xx事件 6xx料理 7xx天赋
    name: string, // 卡牌名
    description: string, // 卡牌描述
    src: string, // 图片url
    cost: number, // 费用
    costChange: number, // 费用变化
    costType: number, // 费用类型  0无色 1水 2火 3雷 4冰 5风 6岩 7草 8同色
    type: number, // 牌类型：0装备 1支援 2事件
    subType: number[], // 副类型：0武器 1圣遗物 2场地 3伙伴 4道具 5料理 6天赋 7战斗行动 8秘传 9元素共鸣 -1减伤 -2复苏料理 -3所属共鸣
    userType: number, // 使用人类型匹配：0全匹配 匹配武器Hero.weaponType 匹配天赋Hero.id
    useCnt: number, // 每回合的效果使用次数
    cnt: number, // 卡牌数量，默认为2
    energy: number, // 需要的充能
    anydice: number, // 除了元素骰以外需要的任意骰
    selected: boolean, // 是否被选择
    pos: number, // 牌的偏移位置
    handle: (card: Card, options?: CardOption) => CardHandleRes, // 卡牌发动的效果函数
    descriptions: string[], // 处理后的技能描述
    canSelectHero: number, // 能选择角色的数量
    canSelectSummon: number, // 能选择的召唤物 -1不能选择 0能选择敌方 1能选择我方
    canSelectSite: number; // 能选择的支援 -1不能选择 0能选择敌方 1能选择我方
    explains: ExplainContent[], // 要解释的文本
}

type DiceVO = {
    val: number, // 颜色
    isSelected: boolean, // 是否被选择
}

type Site = {
    id: number, // 唯一id 从4000开始
    sid: number, // 场地随机唯一id
    card: Card, // 场地卡
    cnt: number, // 次数
    perCnt: number, // 每回合x次
    hpCnt: number, // 回血数
    type: number, // 类型 1轮次 2收集物 3常驻
    handle: (...args: any) => any, // 处理效果函数
    isSelected: boolean, // 是否被选择
    canSelect: boolean, // 能否被选择
}

type Summonee = {
    id: number, // 唯一id 从3000开始
    name: string, // 名字
    description: string, // 描述
    src: string, // 图片url
    useCnt: number, // 可用次数
    maxUse: number, // 最大次数
    shield: number, // 挡伤量(<0)/回复量(>0)
    damage: number, // 伤害量
    pendamage: number, // 穿透伤害
    element: number, // 伤害元素：0物理 1水 2火 3雷 4冰 5风 6岩 7草
    isDestroy: number, // 次数用完后是否销毁：0用完销毁 1用完后回合结束时销毁 2回合结束时强制销毁
    perCnt: number, // 每回合次数
    isTalent: boolean, // 是否有天赋
    statusId: number, // 可能对应的状态 -1不存在
    addition: string[], // 额外信息
    handle: (...args: any) => any, // 处理函数
    descriptions: string[], // 处理后的技能描述
    isSelected: boolean, // 是否被选择
    canSelect: boolean, // 是否能被选择
    isWill: boolean, // 是否为将要生成的召唤物
}

type Status = {
    id: number, // 唯一id 从2000开始
    name: string, // 名字
    description: string, // 描述
    icon: string, // 图标
    group: number, // 0角色状态 1阵营状态
    type: number[], // 类型: 0隐藏 1攻击 2挡伤 3回合 4使用 5翻倍伤害 6条件加伤 7护盾 8元素附魔 9累积 10标记 11准备技能 12死后不删除 13免击倒 14无法行动 15状态暂时不消失
    useCnt: number, // 剩余使用次数: -1为无次数限制
    maxCnt: number, // 最多叠加的次数: 0为不能叠加
    addCnt: number, // 叠加时次数
    perCnt: number, // 每回合使用次数
    roundCnt: number, // 剩余轮次数: -1为无轮次限制
    isTalent: boolean, // 是否有天赋
    handle: (status: Status, options?: StatusOption) => StatusHandleRes, // 处理函数
    summonId: number, // 可能对应的召唤物 -1不存在
    iconBg: string, // 图标背景
    descriptions: string[], // 处理后的技能描述
    isSelected: boolean, // 是否正在发动
    explains: ExplainContent[], // 要解释的文本
    addition: any[], // 额外信息
}

type Hero = {
    id: number, // 唯一id 从1000开始
    name: string, // 角色名
    local: number[], // 所属：0魔物 1蒙德 2璃月 3稻妻 4须弥 5枫丹 6纳塔 7至冬 8愚人众 9丘丘人 10镀金旅团 11始基力:荒性 12始基力:芒性
    maxhp: number, // 最大血量
    hp: number, // 当前血量
    element: number, // 角色元素：0未附着 1水 2火 3雷 4冰 5风 6岩 7草
    weaponType: number, // 武器类型：0无 1单手剑 2双手剑 3弓 4法器 5长柄
    maxEnergy: number, // 最大充能
    energy: number, // 当前充能
    src: string, // 图片url
    skills: Skill[], // 技能组
    weaponSlot: Card | null, // 武器栏
    artifactSlot: Card | null, // 圣遗物栏
    talentSlot: Card | null, // 天赋栏
    inStatus: Status[], // 角色状态
    outStatus: Status[], // 阵营出战状态
    isFront: boolean, // 是否为前台角色
    attachElement: number[], // 附着元素
    canSelect: boolean, // 是否能被选择
    isSelected: number, // 是否被选择
    srcs: string[], // 所有图片url
}

type Skill = {
    name: string, // 技能名
    description: string, // 技能描述
    type: number, // 技能类型：1普通攻击 2元素战技 3元素爆发 4被动技能
    damage: number, // 伤害量
    dmgElement: number, // 伤害元素：-1穿透 0未附着 1水 2火 3雷 4冰 5风 6岩 7草
    cost: { val: number, color: number }[], // 费用列表 [元素骰, 任意骰, 充能]
    energyCost: number, // 所需充能
    attachElement: number, // 附魔属性
    src: string, // 图片url
    handle: (...args: any) => any, // 处理函数
    isForbidden: boolean, // 是否禁用
    dmgChange: number, // 伤害变化
    costChange: number[], // 费用变化 [元素骰, 任意骰]
    useCnt: number, // 技能已使用次数
    isUsed: boolean, // 本场游戏是否使用过
    rdskidx: number, // 准备技能的idx
    descriptions: string[], // 处理后的技能描述
    explains: ExplainContent[], // 要解释的文本
}

type InfoVO = {
    isShow: boolean, // 是否显示模态框
    type: number, // 0-3技能idx 4角色 5卡牌
    info: Hero | Card | Summonee | Site | null,
}

type TipVO = {
    content: string,
    top?: string,
    color?: string,
}

type StatusTask = {
    id: number, // 攻击状态id
    type: number, // 攻击状态类型：0角色状态 1阵营状态
    pidx: number, // 攻击者pidx
    isOppo: number, // 是否为自伤
    trigger: Trigger, // 触发条件
    hidx?: number, // 攻击者hidx
    isSwitchAtk?: boolean, // 是否为下落攻击/刻晴切换攻击
    isQuickAction?: boolean, // 是否为快速行动
    isAfterSwitch?: boolean, // 是否为后切换触发
}

type Cmds = {
    cmd?: Cmd,
    cnt?: number,
    element?: number | number[],
    hidxs?: number[],
    newdices?: number[],
    isAttach?: boolean,
    card?: Card | (Card | number)[] | number,
    subtype?: number | number[],
    status?: Status[],
    isReadySkill?: boolean,
}

type Cmd = 'getDice' | 'getCard' | 'getCard-oppo' | 'getEnergy' | 'heal' | 'getInStatus' | 'getOutStatus' | 'getOutStatusOppo' |
    'getInStatusOppo' | 'reroll' | 'revive' | 'switch-to-self' | 'switch-after-self' | 'switch-before-self' | 'switch-to' |
    'switch-before' | 'switch-after' | 'attach' | 'attack' | 'changeDice' | 'changeCard' | 'changeElement' | 'useSkill' |
    'changePattern' | 'getSkill' | 'loseSkill' | '';

type GameInfo = {
    artifactCnt: number, // 初始牌堆圣遗物数量
    artifactTypeCnt: number, // 初始牌堆圣遗物种类
    weaponCnt: number, // 初始牌堆武器数量
    weaponTypeCnt: number, // 初始牌堆武器种类
    talentCnt: number, // 初始牌堆天赋数量
    talentTypeCnt: number, // 初始牌堆天赋种类
    usedCardIds: number[], // 使用过的牌的id
    destroyedSite: number, // 我方被弃置的支援牌数量
    oppoGetElDmgType: number, // 敌方受到元素伤害的种类(用位计数)
}

type TrgElRe = '1' | '2' | '3' | '4';
type TrgSkType = '1' | '2' | '3';
type TrgEl = '1' | '2' | '3' | '4' | '5' | '6' | '7';
type TrgDmg = 'el' | 'pen' | 'any' | 'water' | 'fire' | 'thunder' | 'ice' | 'wind' | 'rock' | 'grass';
type TrgElReDmg = 'water' | 'fire' | 'thunder' | 'ice';

type Trigger = 'phase-start' | 'phase-end' | 'phase-dice' | 'game-start' | 'action-start' | 'end-phase' | 'any-end-phase' | 'other-skill' |
    'skill' | `skilltype${TrgSkType}` | `other-skilltype${TrgSkType}` | `after-skilltype${TrgSkType}` | 'after-skill' | 'oppo-skill' |
    'change' | 'change-to' | 'change-from' | 'change-oppo' | 'card' | 'elReaction' | `el${TrgEl}Reaction` | `el5Reaction:${TrgElRe}` |
    `other-el${TrgEl}Reaction` | 'other-elReaction' | 'ecard' |
    `el6Reaction:${TrgElRe}` | 'get-elReaction' | `get-el${TrgEl}Reaction` | 'get-elReaction-oppo' | 'kill' | 'killed' | 'will-killed' |
    'dmg' | `${TrgDmg}-dmg` | `${TrgElReDmg}-dmg-wind` | 'getdmg' | `${TrgDmg}-getdmg` | 'getdmg-oppo' | 'revive' | `${TrgDmg}-getdmg-oppo` |
    'heal' | 'useReadySkill' | 'status-destroy' | 'summon-destroy' | 'slot-destroy' | 'site-destroy' | 'calc' | '';

type ExplainContent = Skill | Status | Summonee;


