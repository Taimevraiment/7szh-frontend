import { DEBUFF_BG_COLOR, ELEMENT, STATUS_BG_COLOR, ELEMENT_ICON } from "./constant";
import { newSummonee } from "./summonee";
import { allHidxs, getAtkHidx, getMinhpHidxs, isCdt, minusDiceSkillHandle } from "./utils";

class GIStatus implements Status {
    id: number;
    name: string;
    description: string;
    icon: string;
    group: number;
    type: number[];
    useCnt: number;
    maxCnt: number;
    addCnt: number;
    perCnt: number;
    roundCnt: number;
    isTalent: boolean;
    handle: (status: Status, event?: StatusHandleEvent) => StatusHandleRes;
    iconBg: string;
    descriptions: string[] = [];
    isSelected: boolean = false;
    summonId: number;
    explains: ExplainContent[];
    addition: any[];
    constructor(
        id: number, name: string, description: string, icon: string, group: number, type: number[],
        useCnt: number, maxCnt: number, roundCnt: number, handle?: (status: Status, event?: StatusHandleEvent) => StatusHandleRes | void,
        options: {
            smnId?: number, pct?: number, icbg?: string, expl?: ExplainContent[], act?: number,
            isTalent?: boolean, isReset?: boolean, add?: any[]
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.icon = icon ?? '';
        this.group = group;
        this.type = type;
        this.useCnt = useCnt;
        this.maxCnt = maxCnt;
        this.roundCnt = roundCnt;
        const { smnId = -1, pct = 0, icbg = '', expl = [], act = Math.max(useCnt, roundCnt), isTalent = false, isReset = true, add = [] } = options;
        this.addCnt = act;
        this.summonId = smnId;
        this.perCnt = pct;
        this.iconBg = icbg;
        this.explains = expl;
        this.isTalent = isTalent;
        this.addition = add;
        let thandle = handle ?? (() => ({}));
        if (type.includes(7)) {
            this.icon = 'shield2';
            this.iconBg = STATUS_BG_COLOR[12];
            thandle = (status, event = {}) => {
                let { restDmg = 0 } = event;
                let rest: StatusHandleRes = {};
                if (handle) {
                    const { restDmg: dmg = -1, ...other } = handle(status, event) ?? {};
                    if (dmg > -1) restDmg = dmg;
                    rest = { ...other };
                }
                if (restDmg <= 0) return { restDmg, ...rest };
                const shieldDmg = Math.min(restDmg, status.useCnt);
                status.useCnt -= shieldDmg;
                return { restDmg: restDmg - shieldDmg, ...rest };
            }
        } else if (type.includes(2) && this.icon == '') {
            this.icon = 'shield';
            this.iconBg = '#9268db';
        }
        if (this.iconBg == '') {
            if (id == 2008) {
                this.iconBg = STATUS_BG_COLOR[ELEMENT.indexOf(name.slice(0, 3))];
            } else if (icon.startsWith('buff')) {
                this.iconBg = STATUS_BG_COLOR[9];
            } else if (['satiety', 'freeze', 'debuff'].includes(icon)) {
                this.iconBg = DEBUFF_BG_COLOR;
            } else if (['heal'].includes(icon)) {
                this.iconBg = '#95ff7a';
            } else {
                this.iconBg = '#9a9a9a05';
            }
        }
        this.handle = (status, event = {}) => {
            const { reset = false } = event;
            if (reset) {
                if (isReset) status.perCnt = pct;
                return {}
            }
            return thandle(status, event) ?? {};
        }
    }
}

type StatusObj = {
    [id: string]: (...args: any) => GIStatus
}

const card587sts = (element: number) => {
    const names = ['', '藏镜仕女', '火铳游击兵', '雷锤前锋军', '冰萤术士'];
    return new GIStatus(2123 + element, '愚人众伏兵·' + names[element], `所在阵营的角色使用技能后：对所在阵营的出战角色造成1点[${ELEMENT[element]}伤害]。(每回合1次)；【[可用次数]：{useCnt}】`,
        ELEMENT_ICON[element] + '-dice', 1, [1], 2, 0, -1, status => ({
            damage: isCdt(status.perCnt > 0, 1),
            element: ELEMENT_ICON.indexOf(status.icon.split('-')[0]),
            isOppo: true,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus && eStatus.perCnt > 0) {
                    --eStatus.useCnt;
                    --eStatus.perCnt;
                }
            }
        }), { icbg: DEBUFF_BG_COLOR, pct: 1 });
}

const card751sts = (windEl: number) => {
    return new GIStatus(2118 + windEl, '风物之诗咏·' + ELEMENT[windEl][0], `我方角色和召唤物所造成的[${ELEMENT[windEl]}伤害]+1。；【[可用次数]：{useCnt}】`,
        'buff4', 1, [6], 2, 0, -1, status => ({
            trigger: [`${ELEMENT_ICON[STATUS_BG_COLOR.indexOf(status.iconBg)]}-dmg` as Trigger],
            addDmgCdt: 1,
            exec: () => { --status.useCnt }
        }), { icbg: STATUS_BG_COLOR[windEl] })
}


const statusTotal: StatusObj = {
    2000: () => new GIStatus(2000, '', '', '', -1, [], 0, 0, 0),

    2001: () => new GIStatus(2001, '冰莲', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2], 2, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: restDmg - 1 };
        }),

    2002: (isTalent = false) => new GIStatus(2002, '雨帘剑', `【我方出战角色受到至少为${isTalent ? 2 : 3}的伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】`,
        '', 1, [2], isTalent ? 3 : 2, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg < 3 - (status.isTalent ? 1 : 0)) return { restDmg };
            --status.useCnt;
            return { restDmg: restDmg - 1 };
        }, { isTalent }),

    2003: (icon = '') => new GIStatus(2003, '虹剑势', '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 3, 0, -1, () => ({
            damage: 1,
            element: 1,
            trigger: ['after-skilltype1'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: STATUS_BG_COLOR[1] }),

    2004: () => new GIStatus(2004, '冻结', '角色无法使用技能持续到回合结束。；角色受到[火元素伤害]或[物理伤害]时，移除此效果，使该伤害+2', 'freeze', 0, [3, 10, 14], -1, 0, 1),

    2005: () => new GIStatus(2005, '草原核', '【我方对敌方出战角色造成[火元素伤害]或[雷元素伤害]时，】伤害值+2。；【[可用次数]：{useCnt}】',
        'sts2005', 1, [6], 1, 0, -1, (status, event = {}) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 2,
                trigger: ['fire-dmg', 'thunder-dmg'],
                exec: () => { --status.useCnt },
            }
        }, { icbg: STATUS_BG_COLOR[7] }),

    2006: () => new GIStatus(2006, '激化领域', '【我方对敌方出战角色造成[雷元素伤害]或[草元素伤害]时，】伤害值+1。；【[可用次数]：{useCnt}】',
        'sts2006', 1, [6], 2, 0, -1, (status, event = {}) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 1,
                trigger: ['grass-dmg', 'thunder-dmg'],
                exec: () => { --status.useCnt },
            }
        }),

    2007: () => new GIStatus(2007, '结晶', '为我方出战角色提供1点[护盾]。(可叠加，最多到2)', '', 1, [7], 1, 2, -1),

    2008: (el = 0, rcnt = 1, addDmg = 0) => new GIStatus(2008, `${ELEMENT[el]}附魔`, `所附属角色造成的[物理伤害]变为[${ELEMENT[el]}伤害]${addDmg > 0 ? `，且造成的[${ELEMENT[el]}伤害]+${addDmg}` : ''}。；【[持续回合]：{roundCnt}】`,
        `buff${addDmg > 0 ? '4' : ''}`, 0, [8], -1, 0, rcnt, status => ({
            attachEl: STATUS_BG_COLOR.indexOf(status.iconBg),
            addDmg: -status.perCnt,
        }), { pct: -addDmg }),

    2009: () => new GIStatus(2009, '饱腹', '本回合无法食用更多的｢料理｣。', 'satiety', 0, [3, 10], -1, 0, 1),

    2010: () => new GIStatus(2010, '换班时间(生效中)', '【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。',
        'buff2', 1, [4, 10], 1, 0, -1, status => ({
            minusDiceHero: 1,
            trigger: ['change-from'],
            exec: (_eStatus, execEvent = {}) => {
                let { changeHeroDiceCnt = 0 } = execEvent;
                if (changeHeroDiceCnt > 0) {
                    --status.useCnt;
                    --changeHeroDiceCnt;
                }
                return { changeHeroDiceCnt }
            }
        })),

    2011: () => new GIStatus(2011, '交给我吧！(生效中)', '【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。',
        'buff3', 1, [4, 10], 1, 0, -1, status => ({
            isQuickAction: true,
            trigger: ['change-from'],
            exec: () => { --status.useCnt },
        })),

    2012: (icon = '') => new GIStatus(2012, '泡影', '【我方造成技能伤害时：】移除此状态，使本次伤害加倍。',
        icon, 1, [5, 10], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: restDmg * 2 };
        }, { icbg: STATUS_BG_COLOR[1] }),

    2013: (summonId: number) => new GIStatus(2013, '虚影', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2], 1, 0, 1, (status, event = {}) => {
            const { restDmg = 0, summon } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            if (summon) --summon.useCnt;
            return { restDmg: restDmg - 1 };
        }, { smnId: summonId }),

    2014: () => new GIStatus(2014, '绝云锅巴(生效中)', '本回合中，目标角色下一次｢普通攻击｣造成的伤害+1。',
        'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
            addDmgType1: 1,
            trigger: ['skilltype1'],
            exec: () => { --status.useCnt },
        })),

    2015: () => new GIStatus(2015, '仙跳墙(生效中)', '本回合中，目标角色下一次｢元素爆发｣造成的伤害+3。',
        'buff2', 0, [4, 6, 10], 1, 0, 1, status => ({
            addDmgType3: 3,
            trigger: ['skilltype3'],
            exec: () => { --status.useCnt },
        })),

    2016: () => new GIStatus(2016, '烤蘑菇披萨(生效中)', '两回合内结束阶段再治疗此角色1点。',
        'heal', 0, [3], 2, 0, -1, (_status, event = {}) => {
            const { hidx = -1 } = event;
            return {
                trigger: ['phase-end'],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                    return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
                },
            }
        }),

    2017: () => new GIStatus(2017, '鹤归之时(生效中)', '【我方下一次使用技能后：】将下一个我方后台角色切换到场上。',
        'buff3', 1, [4, 10], 1, 0, -1, status => ({
            trigger: ['skill'],
            cmds: [{ cmd: 'switch-after-self', cnt: 2500 }],
            exec: () => { --status.useCnt },
        })),

    2018: () => new GIStatus(2018, '莲花酥(生效中)', '本回合中，目标角色下次受到的伤害-3。',
        '', 0, [2, 10], 1, 0, 1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: Math.max(0, restDmg - 3) };
        }),

    2019: () => new GIStatus(2019, '兽肉薄荷卷(生效中)', '目标角色在本回合结束前，之后的三次｢普通攻击｣都少花费1个[无色元素骰]。',
        'buff2', 0, [4], 3, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
            return {
                trigger: ['skilltype1'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                },
            }
        }),

    2020: (icon = '') => new GIStatus(2020, '旋火轮', '【我方角色使用技能后：】造成2点[火元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 2, 0, -1, () => ({
            damage: 2,
            element: 2,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: STATUS_BG_COLOR[2] }),

    2021: () => new GIStatus(2021, '北地烟熏鸡(生效中)', '本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。',
        'buff2', 0, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
            return {
                trigger: ['skilltype1'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                },
            }
        }),

    2022: () => new GIStatus(2022, '复苏冷却中', '本回合无法通过｢料理｣复苏角色。', 'satiety', 1, [3, 10], -1, 0, 1),

    2023: () => new GIStatus(2023, '刺身拼盘(生效中)', '本回合中，该角色｢普通攻击｣造成的伤害+1。',
        'buff2', 0, [4, 6, 10], -1, 0, 1, () => ({ addDmgType1: 1 })),

    2024: () => new GIStatus(2024, '唐杜尔烤鸡(生效中)', '本回合中，所附属角色下一次｢元素战技｣造成的伤害+2。',
        'buff2', 0, [4, 6, 10], 1, 0, 1, status => ({
            addDmgType2: 2,
            trigger: ['skilltype2'],
            exec: () => { --status.useCnt },
        })),

    2025: () => new GIStatus(2025, '黄油蟹蟹(生效中)', '本回合中，所附属角色下次受到伤害-2。',
        '', 0, [2, 10], 1, 0, 1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: Math.max(0, restDmg - 2) };
        }),

    2026: (useCnt: number) => new GIStatus(2026, '千岩之护', '根据｢璃月｣角色的数量提供[护盾]，保护所附属角色。', '', 0, [7], useCnt, 0, -1),

    2027: () => new GIStatus(2027, '璇玑屏', '【我方出战角色受到至少为2的伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2, 6], 2, 0, -1, (status, event = {}) => {
            const { restDmg = -1, heros = [] } = event;
            if (restDmg > -1) {
                if (restDmg < 2) return { restDmg };
                --status.useCnt;
                return { restDmg: restDmg - 1 };
            }
            if (!heros.find(h => h.id == 1501)?.talentSlot) return;
            return {
                trigger: ['rock-dmg'],
                addDmgCdt: 1,
            }
        }),

    2028: () => new GIStatus(2028, '新叶', '【我方角色的技能引发[草元素相关反应]后：】造成1点[草元素伤害]。(每回合1次)；【[持续回合]：{roundCnt}】',
        'buff6', 1, [1], 1, 0, 1, () => ({
            damage: 1,
            element: 7,
            trigger: ['el7Reaction'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    2029: () => new GIStatus(2029, '元素共鸣：热诚之火(生效中)', '本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。',
        'buff2', 0, [6, 10], 1, 0, 1, (status, event = {}) => ({
            addDmgCdt: 3,
            trigger: (event?.isSkill ?? -1) > -1 ? ['el2Reaction'] : [],
            exec: () => { --status.useCnt },
        })),

    2030: () => new GIStatus(2030, '元素共鸣：粉碎之冰(生效中)', '本回合中，我方当前出战角色下一次造成的伤害+2。',
        'buff2', 0, [6, 10], 1, 0, 1, status => ({
            addDmg: 2,
            trigger: ['skill'],
            exec: () => { --status.useCnt },
        })),

    2031: () => new GIStatus(2031, '元素共鸣：坚定之岩(生效中)', '【本回合中，我方角色下一次造成[岩元素伤害]后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。',
        'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { heros = [], isSkill = -1, dmgElement = 0 } = event;
            return {
                trigger: ['rock-dmg', 'after-skill'],
                exec: () => {
                    const shieldStatus = heros.find(h => h.isFront)?.outStatus.find(ost => ost.type.includes(7));
                    if (shieldStatus && (isSkill > -1 || dmgElement == 6)) {
                        shieldStatus.useCnt += 3;
                        --status.useCnt;
                    }
                }
            }
        }),

    2032: () => new GIStatus(2032, '元素共鸣：蔓生之草(生效中)', '本回合中，我方下一次引发元素反应时，造成的伤害+2。',
        'buff2', 1, [4, 6, 10], 1, 0, 1, status => ({
            addDmgCdt: 2,
            trigger: ['elReaction'],
            exec: () => { --status.useCnt },
        })),

    2033: (useCnt: number = 1) => new GIStatus(2033, '猫爪护盾', '为我方出战角色提供1点[护盾]。', '', 1, [7], useCnt, 0, -1),

    2034: (icon = '', isTalent = false) => new GIStatus(2034, '鼓舞领域', '【我方角色使用技能时：】如果该角色生命值至少为7，则使此伤害额外+2; 技能结算后，如果该角色生命值不多于6，则治疗该角色2点。；【[持续回合]：{roundCnt}】',
        icon, 1, [1, 4], -1, 0, 2, (status, event = {}) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            if (hidx == -1) return;
            const fHero = heros[hidx];
            return {
                trigger: ['skill', 'after-skill'],
                addDmgCdt: isCdt(fHero.hp >= 7 || status.isTalent, 2),
                heal: isCdt(fHero.hp <= 6 && trigger == 'after-skill', Math.min(2, fHero.maxhp - fHero.hp)),
            }
        }, { icbg: STATUS_BG_COLOR[2], isTalent }),

    2035: (icon = '') => new GIStatus(2035, '雷狼', '【所附属角色使用｢普通攻击｣或｢元素战技｣后：】造成2点[雷元素伤害]。；【[持续回合]：{roundCnt}】',
        icon, 0, [1], -1, 0, 2, () => ({
            damage: 2,
            element: 3,
            trigger: ['after-skilltype1', 'after-skilltype2'],
        }), { icbg: STATUS_BG_COLOR[3] }),

    2036: () => new GIStatus(2036, '护体岩铠', '为我方出战角色提供2点[护盾]。此[护盾]耗尽前，我方受到的[物理伤害]减半。(向上取整)',
        '', 1, [7], 2, 0, -1, (_status, event = {}) => {
            const { restDmg = 0, willAttach = -1 } = event;
            if (restDmg < 2 || willAttach > 0) return { restDmg };
            return { restDmg: Math.ceil(restDmg / 2) };
        }),

    2037: (icon = '') => new GIStatus(2037, '大扫除', '【角色使用｢普通攻击｣时：】少花费1个[岩元素骰]。(每回合1次)；角色｢普通攻击｣造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；【[持续回合]：{roundCnt}】',
        icon, 0, [6, 8], -1, 0, 2, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => status.perCnt > 0);
            return {
                addDmgType1: 2,
                ...minusSkillRes,
                trigger: ['skilltype1'],
                attachEl: 6,
                exec: () => {
                    if (status.perCnt > 0 && isMinusSkill) --status.perCnt;
                },
            }
        }, { pct: 1, icbg: STATUS_BG_COLOR[6] }),

    2038: (icon = '') => new GIStatus(2038, '寒冰之棱', '【我方切换角色后：】造成2点[冰元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 3, 0, -1, () => ({
            damage: 2,
            element: 4,
            trigger: ['change-from'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: STATUS_BG_COLOR[4] }),

    2039: (isTalent = false) => new GIStatus(2039, '重华叠霜领域', `我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[冰元素伤害]${isTalent ? '，｢普通攻击｣造成的伤害+1' : ''}。；【[持续回合]：{roundCnt}】`,
        'buff', 1, isTalent ? [6, 8] : [8], -1, 0, 2, (status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            const isWeapon = hidx > -1 && [1, 2, 5].includes(heros[hidx]?.weaponType ?? 0);
            return {
                trigger: ['skilltype1'],
                addDmgType1: isCdt(status.isTalent && isWeapon, 1),
                attachEl: isCdt(isWeapon, 4),
            }
        }, { icbg: STATUS_BG_COLOR[4], isTalent }),

    2040: (isTalent = false) => new GIStatus(2040, '庭火焰硝', `所附属角色｢普通攻击｣伤害+1，造成的[物理伤害]变为[火元素伤害]。${isTalent ? '；【所附属角色使用｢普通攻击｣后：】造成1点[火元素伤害]。' : ''}；【[可用次数]：{useCnt}】`,
        'buff4', 0, isTalent ? [1, 6, 8] : [6, 8], isTalent ? 3 : 2, 0, -1, (status, event = {}) => {
            const { trigger = '' } = event;
            const dmgCdt = status.type.includes(1) && trigger == 'after-skilltype1';
            return {
                trigger: ['skilltype1', 'after-skilltype1'],
                addDmgType1: 1,
                damage: isCdt(dmgCdt, 1),
                element: 2,
                attachEl: 2,
                exec: eStatus => {
                    if (!status.isTalent) --status.useCnt;
                    else if (eStatus) --eStatus.useCnt;
                },
            }
        }, { icbg: STATUS_BG_COLOR[2], isTalent }),

    2041: (icon = '') => new GIStatus(2041, '琉金火光', '宵宫以外的我方角色使用技能后：造成1点[火元素伤害]。；【[持续回合]：{roundCnt}】',
        icon, 1, [1], -1, 0, 2, (_status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            return {
                damage: 1,
                element: 2,
                trigger: isCdt(hidx > -1 && heros[hidx].id != 1204, ['after-skill']),
            }
        }, { icbg: STATUS_BG_COLOR[2] }),

    2042: (summonId: number) => new GIStatus(2042, '纯水幻形·蛙', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0, summon } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            if (summon) --summon.useCnt;
            return { restDmg: restDmg - 1 };
        }, { smnId: summonId }),

    2043: (isTalent = false) => new GIStatus(2043, '水光破镜', '所附属角色受到的[水元素伤害]+1。；【[持续回合]：{roundCnt}】；(同一方场上最多存在一个此状态)',
        'debuff', 0, isTalent ? [4, 6] : [6], -1, 0, isTalent ? 3 : 2, status => {
            const trigger: Trigger[] = ['water-getdmg'];
            if (status.isTalent) trigger.push('change-from');
            return {
                getDmg: 1,
                addDiceHero: isCdt(status.isTalent, 1),
                trigger,
                onlyOne: true,
            }
        }, { isTalent }),

    2044: (isTalent = false) => new GIStatus(2044, '潜行', '所附属角色受到的伤害-1，造成的伤害+1。；【[可用次数]：{useCnt}】',
        '', 0, isTalent ? [2, 6, 8] : [2, 6], isTalent ? 3 : 2, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg > 0) --status.useCnt;
            return {
                addDmg: 1,
                restDmg: Math.max(0, restDmg - 1),
                trigger: ['skill'],
                attachEl: isCdt(status.isTalent, 2),
                exec: () => { --status.useCnt },
            }
        }, { isTalent }),

    2045: () => new GIStatus(2045, '岩盔', '【所附属角色受到伤害时：】抵消1点伤害。；抵消[岩元素伤害]时，需额外消耗1次[可用次数]。；【[可用次数]：{useCnt}】',
        '', 0, [2], 3, 0, -1, (status, event = {}) => {
            const { restDmg = 0, willAttach = 0, heros = [], hidx = -1 } = event;
            if (restDmg <= 0) return { restDmg }
            --status.useCnt;
            if (status.useCnt > 0 && willAttach == 6) --status.useCnt;
            if (status.useCnt == 0) {
                const ist2046 = heros[hidx].inStatus.find(ist => ist.id == 2046);
                if (ist2046) ist2046.useCnt = 0;
            }
            return { restDmg: restDmg - 1 }
        }),

    2046: () => new GIStatus(2046, '坚岩之力', '角色造成的[物理伤害]变为[岩元素伤害]。；【每回合1次：】角色造成的伤害+1。；【角色所附属的岩盔被移除后：】也移除此状态。',
        'buff4', 0, [4, 6, 8, 10], 1, 0, -1, status => ({
            addDmg: isCdt(status.perCnt > 0, 1),
            trigger: ['skill'],
            attachEl: 6,
            exec: () => {
                if (status.perCnt > 0) --status.perCnt;
            },
        }), { pct: 1 }),

    2047: () => new GIStatus(2047, '活化激能', '【本角色造成或受到元素伤害后：】累积1层｢活化激能｣。(最多累积3层)；【结束阶段：】如果｢活化激能｣层数已达到上限，就将其清空。同时，角色失去所有[充能]。',
        'sts2047', 0, [9], 0, 3, -1, (status, event = {}) => {
            const { trigger = '', heros = [], hidx = -1 } = event;
            return {
                trigger: ['el-dmg', 'el-getdmg', 'phase-end'],
                exec: () => {
                    if (hidx == -1) return;
                    const hero = heros[hidx];
                    const maxCnt = status.maxCnt + (!!hero.talentSlot ? 1 : 0);
                    if (trigger == 'phase-end') {
                        if (status.useCnt == maxCnt) {
                            status.useCnt = 0;
                            return { cmds: [{ cmd: 'getEnergy', cnt: -hero.energy, hidxs: [hidx] }] }
                        }
                    } else if (status.useCnt < maxCnt) {
                        ++status.useCnt;
                    }
                },
            }
        }, { icbg: STATUS_BG_COLOR[7] }),

    2048: () => new GIStatus(2048, '千年的大乐章·别离之歌', '我方角色造成的伤害+1。；【[持续回合]：{roundCnt}】',
        'buff5', 0, [3, 6], -1, 0, 2, () => ({ addDmg: 1 })),

    2049: () => new GIStatus(2049, '叛逆的守护', '为我方出战角色提供1点[护盾]。(可叠加，最多到2)', '', 1, [7], 1, 2, -1),

    2050: () => new GIStatus(2050, '重嶂不移', '提供2点[护盾]，保护所附属角色。', '', 0, [7], 2, 0, -1),

    2051: () => new GIStatus(2051, '重攻击(生效中)', '本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。',
        'buff3', 0, [6, 10], 1, 0, 1, (status, event = {}) => ({
            addDmgType1: 1,
            addDmgCdt: isCdt(event?.isChargedAtk, 1),
            trigger: ['skilltype1'],
            exec: () => { --status.useCnt },
        })),

    2052: () => new GIStatus(2052, '大梦的曲调(生效中)', '【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。',
        'buff2', 1, [4, 10], 1, 0, -1, (status, event = {}) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && [0, 1].some(v => card.subType.includes(v)) && card.cost > mdc;
            return {
                minusDiceCard: isCdt(isMinus, 1),
                trigger: ['card'],
                exec: () => {
                    if (isMinus) --status.useCnt;
                },
            }
        }),

    2053: () => new GIStatus(2053, '藏锋何处(生效中)', '【本回合中，我方下一次打出｢武器｣手牌时：】少花费2个元素骰。',
        'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && card.subType.includes(0) && card.cost > mdc;
            return {
                minusDiceCard: isCdt(isMinus, 2),
                trigger: ['card'],
                exec: () => {
                    if (isMinus) --status.useCnt;
                },
            }
        }),

    2054: () => new GIStatus(2054, '自由的新风(生效中)', '【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：{useCnt}】',
        'buff3', 1, [4, 10], 1, 0, 1, status => ({
            trigger: ['kill'],
            isQuickAction: true,
            exec: () => { --status.useCnt },
        })),

    2055: () => new GIStatus(2055, '旧时庭园(生效中)', '本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。',
        'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && card.subType.some(v => v < 2) && card.cost > mdc;
            return {
                minusDiceCard: isCdt(isMinus, 2),
                trigger: ['card'],
                exec: () => {
                    if (isMinus) --status.useCnt;
                },
            }
        }),

    2056: () => new GIStatus(2056, '风与自由(生效中)', '【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。',
        'buff2', 1, [4, 10], 1, 0, 1, status => ({
            trigger: ['skill'],
            cmds: [{ cmd: 'switch-after-self', cnt: 2500 }],
            exec: () => { --status.useCnt },
        })),

    2057: () => new GIStatus(2057, '岩与契约(生效中)', '【下回合行动阶段开始时：】生成3点[万能元素骰]，并摸1张牌。',
        'buff3', 1, [4, 10], 1, 0, -1, () => ({
            trigger: ['phase-start'],
            cmds: [{ cmd: 'getDice', cnt: 3, element: 0 }, { cmd: 'getCard', cnt: 1 }],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    2058: (isTalent = false) => new GIStatus(2058, '爆裂火花', '【所附属角色进行[重击]时：】少花费1个[火元素骰]，并且伤害+1。；【[可用次数]：{useCnt}】',
        'buff5', 0, [4, 6], isTalent ? 2 : 1, 0, -1, (status, event = {}) => {
            if (!event.isChargedAtk) return;
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] });
            return {
                trigger: ['skilltype1'],
                addDmgCdt: 1,
                ...minusSkillRes,
                exec: () => { --status.useCnt },
            }
        }, { isTalent }),

    2059: (icon = '') => new GIStatus(2059, '轰轰火花', '【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[火元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 2, 0, -1, () => ({
            damage: 2,
            element: 2,
            isOppo: true,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        }), { icbg: DEBUFF_BG_COLOR }),

    2060: (icon = '') => new GIStatus(2060, '启途誓使', '【结束阶段：】累积1级｢凭依｣。；【根据｢凭依｣级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2;；大于等于6级：｢凭依｣级数-4。',
        icon, 0, [8, 9], 0, 6, -1, (status, event = {}) => {
            const { trigger = '' } = event;
            const isAttachEl = status.useCnt >= 2;
            return {
                trigger: ['phase-end', 'skilltype3'],
                addDmg: isCdt(status.useCnt >= 4, 2),
                attachEl: isCdt(isAttachEl, 3),
                isUpdateAttachEl: isAttachEl,
                exec: () => {
                    if (trigger == 'phase-end') ++status.useCnt;
                    else if (trigger == 'skilltype3') status.useCnt += 2;
                    if (status.useCnt >= status.maxCnt) status.useCnt -= 4;
                }
            }
        }, { icbg: STATUS_BG_COLOR[3] }),

    2061: (name: string) => new GIStatus(2061, name + '(生效中)', '【角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时：】少花费2个元素骰。',
        'buff2', 0, [3, 4, 10], 1, 0, 1, (status, event = {}) => {
            const { card, heros = [], hidx = -1, trigger = '', minusDiceCard: mdc = 0 } = event;
            const isMinusCard = card && card.subType.includes(6) && card.userType == heros[hidx]?.id && card.cost > mdc;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 2] });
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isMinusCard, 2),
                trigger: ['skilltype2', 'card'],
                exec: () => {
                    if (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusSkill) {
                        --status.useCnt;
                    }
                }
            }
        }),

    2062: (expl?: ExplainContent[]) => new GIStatus(2062, '捉浪·涛拥之守', '本角色将在下次行动时，直接使用技能：【踏潮】。；【准备技能期间：】提供2点[护盾]，保护所附属角色。',
        '', 0, [7, 9, 11], 2, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 1,
            exec: () => {
                status.type.splice(status.type.indexOf(9), 1);
                status.useCnt = 0;
            }
        }), { expl }),

    2063: (icon = '') => new GIStatus(2063, '雷兽之盾', '【我方角色｢普通攻击｣后：】造成1点[雷元素伤害]。；【我方角色受到至少为3的伤害时：】抵消其中1点伤害。；【[持续回合]：{roundCnt}】',
        icon, 0, [1, 2], -1, 0, 2, (_status, event = {}) => {
            const { restDmg = 0 } = event;
            return {
                damage: 1,
                element: 3,
                trigger: ['after-skilltype1'],
                restDmg: restDmg < 3 ? restDmg : restDmg - 1,
            }
        }, { icbg: STATUS_BG_COLOR[3] }),

    2064: () => new GIStatus(2064, '鸣煌护持', '所附属角色｢元素战技｣和｢元素爆发｣造成的伤害+1。；【[可用次数]：{useCnt}】',
        'buff5', 0, [6], 2, 0, -1, (status, event = {}) => {
            const { skilltype = -1, hasDmg = false } = event;
            const trigger: Trigger[] = [];
            if (hasDmg && [2, 3].includes(skilltype)) trigger.push(`skilltype${skilltype}` as Trigger);
            return {
                addDmgType2: 1,
                addDmgType3: 1,
                trigger,
                exec: () => { --status.useCnt },
            }
        }),

    2065: (icon = '') => new GIStatus(2065, '仪来羽衣', '所附属角色｢普通攻击｣造成的伤害+1。；【所附属角色｢普通攻击｣后：】治疗所有我方角色1点。；【[持续回合]：{roundCnt}】',
        icon, 0, [1, 6], -1, 0, 2, (_status, event = {}) => {
            const { heros = [], trigger = '' } = event;
            return {
                addDmgType1: 1,
                trigger: ['skilltype1', 'after-skilltype1'],
                heal: isCdt(trigger == 'after-skilltype1', 1),
                hidxs: allHidxs(heros),
            }
        }, { icbg: STATUS_BG_COLOR[1] }),

    2066: (expl?: ExplainContent[]) => new GIStatus(2066, '冷酷之心', '【所附属角色使用冰潮的涡旋时：】移除此状态，使本次伤害+3。',
        'buff4', 0, [4, 6, 10], 1, 0, -1, status => ({
            trigger: ['skilltype2'],
            addDmgCdt: 3,
            exec: () => { --status.useCnt },
        }), { icbg: STATUS_BG_COLOR[4], expl }),

    2067: () => new GIStatus(2067, '泷廻鉴花', '所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[水元素伤害]。；【[可用次数]：{useCnt}】',
        'buff4', 0, [6, 8], 3, 0, -1, status => {
            return {
                addDmgType1: 1,
                trigger: ['skilltype1'],
                attachEl: 1,
                exec: () => { --status.useCnt },
            }
        }, { icbg: STATUS_BG_COLOR[1] }),

    2068: () => new GIStatus(2068, '乱神之怪力', '【所附属角色进行[重击]时：】造成的伤害+1。如果[可用次数]至少为2，则还会使本技能少花费1个[无色元素骰]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)',
        'buff4', 0, [6], 1, 3, -1, (status, event = {}) => {
            if (!event.isChargedAtk) return;
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] }, () => status.useCnt >= 2);
            return {
                addDmgCdt: 1,
                ...minusSkillRes,
                trigger: ['skilltype1'],
                exec: () => { --status.useCnt },
            }
        }),

    2069: (icon = '') => new GIStatus(2069, '怒目鬼王', '所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[岩元素伤害]。；【[持续回合]：{roundCnt}】；【所附属角色｢普通攻击｣后：】为其附属【乱神之怪力】。(每回合1次)',
        icon, 0, [6, 8], -1, 0, 2, status => ({
            addDmgType1: 1,
            attachEl: 6,
            trigger: ['skilltype1'],
            exec: () => {
                if (status.perCnt <= 0) return;
                --status.perCnt;
                return { inStatus: [heroStatus(2068)] }
            }
        }), { icbg: STATUS_BG_COLOR[6], pct: 1 }),

    2070: (summonId: number) => new GIStatus(2070, '阿丑', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0, summon } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            if (summon) --summon.useCnt;
            return { restDmg: restDmg - 1 };
        }, { smnId: summonId }),

    2071: () => new GIStatus(2071, '通塞识', '【所附属角色进行[重击]时：】造成的[物理伤害]变为[草元素伤害]，并且会在技能结算后召唤【藏蕴花矢】。；【[可用次数]：{useCnt}】',
        'buff', 0, [16], 3, 0, -1, (status, event = {}) => {
            if (!event.isChargedAtk) return;
            return {
                summon: [newSummonee(3027)],
                trigger: ['skilltype1'],
                attachEl: 7,
                exec: () => { --status.useCnt },
            }
        }, { icbg: STATUS_BG_COLOR[7] }),

    2072: () => new GIStatus(2072, '辰砂往生录(生效中)', '本回合中，角色｢普通攻击｣造成的伤害+1。',
        'buff5', 0, [6, 10], -1, 0, 1, () => ({ addDmgType1: 1 })),

    2073: (isTalent = false) => new GIStatus(2073, '冰翎', `我方角色造成的[冰元素伤害]+1。(包括角色引发的‹4冰元素›扩散的伤害)；【[可用次数]：{useCnt}】${isTalent ? '；我方角色通过｢普通攻击｣触发此效果时，不消耗｢[可用次数]｣。(每回合1次)' : ''}`,
        'buff4', 1, [6], 2, 0, -1, (status, event = {}) => {
            const { skilltype = -1, isSkill = -1 } = event;
            return {
                addDmgCdt: 1,
                trigger: isSkill > -1 ? ['ice-dmg', 'ice-dmg-wind'] : [],
                exec: () => {
                    if (status.perCnt == 1 && skilltype == 1) {
                        --status.perCnt;
                    } else {
                        --status.useCnt;
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[4], pct: isCdt(isTalent, 1), isTalent }),

    2074: (icon = '') => new GIStatus(2074, '远程状态', '【所附属角色进行[重击]后：】目标角色附属【断流】。',
        icon, 0, [10], -1, 0, -1, (_status, event = {}) => ({
            trigger: ['skilltype1'],
            exec: () => {
                const { isChargedAtk = false, heros = [], hidx = -1 } = event;
                return { inStatusOppo: isCdt(isChargedAtk, [heroStatus(2076, heros[hidx].skills[2].src)]) }
            }
        }), { icbg: STATUS_BG_COLOR[1] }),

    2075: (icon = '') => new GIStatus(2075, '近战状态', '角色造成的[物理伤害]转换为[水元素伤害]。；【角色进行[重击]后：】目标角色附属【断流】。；角色对附属有【断流】的角色造成的伤害+1;；【角色对已附属有断流的角色使用技能后：】对下一个敌方后台角色造成1点[穿透伤害]。(每回合至多2次)；【[持续回合]：{roundCnt}】',
        icon, 0, [3, 6, 8], -1, 0, 2, (status, event = {}) => {
            const { isChargedAtk, heros = [], hidx = -1, eheros = [], trigger = '' } = event;
            const efHero = eheros.find(h => h.isFront);
            const isDuanliu = efHero?.inStatus.some(ist => ist.id == 2076);
            let afterIdx = (eheros.findIndex(h => h.isFront) + 1) % eheros.length;
            if ((eheros[afterIdx]?.hp ?? 0) <= 0) afterIdx = (eheros.findIndex(h => h.isFront) - 1 + eheros.length) % eheros.length;
            if ((eheros[afterIdx]?.hp ?? 0) <= 0) afterIdx = -1;
            const isPenDmg = status.perCnt > 0 && isDuanliu && afterIdx > -1 && trigger == 'skill';
            return {
                trigger: ['phase-end', 'skill'],
                pendamage: isCdt(isPenDmg, 1),
                hidxs: isCdt(isPenDmg, [afterIdx]),
                addDmgCdt: isCdt(isDuanliu, 1),
                attachEl: 1,
                exec: () => {
                    if (trigger == 'phase-end' && status.roundCnt == 1) {
                        return { inStatus: [heroStatus(2074, heros[hidx].skills[3].src)] }
                    }
                    if (isPenDmg) --status.perCnt;
                    return { inStatusOppo: isCdt(isChargedAtk, [heroStatus(2076, heros[hidx].skills[2].src)]) }
                },
            }
        }, { icbg: STATUS_BG_COLOR[1], pct: 2 }),

    2076: (icon = '') => new GIStatus(2076, '断流', '【所附属角色被击倒后：】对所在阵营的出战角色附属【断流】。',
        icon, 0, [1, 4, 10, 12], -1, 0, -1, (status, event = {}) => {
            const { heros = [], hidx = -1, eheros = [], hidxs, trigger = '' } = event;
            const triggers: Trigger[] = ['killed'];
            const isTalent = trigger == 'phase-end' && !!eheros.find(h => h.id == 1106)?.talentSlot && heros[hidx].isFront;
            if (isTalent) triggers.push('phase-end');
            return {
                trigger: triggers,
                pendamage: isCdt(isTalent, 1),
                hidxs: isCdt(isTalent, [hidx]),
                isOppo: isCdt(isTalent, true),
                exec: () => {
                    if (trigger == 'killed') {
                        const type12 = status.type.indexOf(12);
                        if (type12 > -1) status.type.splice(type12, 1);
                        return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2076, status.icon)], hidxs }] }
                    }
                }
            }
        }, { icbg: DEBUFF_BG_COLOR }),

    2077: (summonId: number) => new GIStatus(2077, '兔兔伯爵', '【我方出战角色受到伤害时：】抵消2点伤害。；【[可用次数]：{useCnt}】',
        '', 1, [2], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0, summon } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            if (summon) --summon.useCnt;
            return { restDmg: Math.max(0, restDmg - 2) };
        }, { smnId: summonId }),

    2078: () => new GIStatus(2078, '彼岸蝶舞', '所附属角色造成的[物理伤害]变为[火元素伤害]，且角色造成的[火元素伤害]+1。；【所附属角色进行[重击]时：】目标角色附属【血梅香】。；【[持续回合]：{roundCnt}】',
        'buff5', 0, [8], -1, 0, 2, (_status, event = {}) => ({
            addDmg: 1,
            attachEl: 2,
            trigger: ['skill'],
            exec: () => ({ inStatusOppo: isCdt<Status[]>(event.isChargedAtk, [heroStatus(2079)]) })
        }), { expl: [heroStatus(2079)] }),

    2079: () => new GIStatus(2079, '血梅香', '【结束阶段：】对所附属角色造成1点[火元素伤害]。；【[可用次数]：{useCnt}】',
        'sts2079', 0, [1], 1, 0, -1, () => ({
            damage: 1,
            element: 2,
            isOppo: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: DEBUFF_BG_COLOR }),

    2080: (icon = '', expl?: ExplainContent[]) => new GIStatus(2080, '诸愿百眼之轮', '【其他我方角色使用｢元素爆发｣后：】累积1点｢愿力｣。(最多累积3点)；【所附属角色使用奥义·梦想真说时：】消耗所有｢愿力｣，每点｢愿力｣使造成的伤害+1。',
        icon, 0, [6, 9], 0, 3, -1, (status, event = {}) => {
            const { trigger = '' } = event;
            return {
                trigger: ['other-skilltype3', 'skilltype3'],
                exec: () => {
                    if (trigger == 'skilltype3') {
                        status.useCnt = 0;
                    } else if (trigger == 'other-skilltype3') {
                        status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[3], expl }),

    2081: (icon = '') => new GIStatus(2081, '天狐霆雷', '【我方选择行动前：】造成3点[雷元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1, 10], 1, 0, -1, () => ({
            damage: 3,
            element: 3,
            trigger: ['action-start'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: STATUS_BG_COLOR[3] }),

    2082: (isTalent = false) => new GIStatus(2082, '风域', `【我方执行｢切换角色｣行动时：】少花费1个元素骰。${isTalent ? '触发该效果后，使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。' : ''}；【[可用次数]：{useCnt}】`,
        'buff3', 1, [4], 2, 0, -1, status => ({
            minusDiceHero: 1,
            trigger: ['change-from'],
            exec: (_eStatus, execEvent = {}) => {
                const { changeHeroDiceCnt = 0 } = execEvent;
                if (changeHeroDiceCnt == 0) return { changeHeroDiceCnt }
                --status.useCnt;
                return {
                    changeHeroDiceCnt: changeHeroDiceCnt - 1,
                    outStatus: isCdt(status.isTalent, [heroStatus(2108)]),
                }
            }
        }), { isTalent }),

    2084: () => new GIStatus(2084, '红羽团扇(生效中)', '本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。',
        'buff2', 1, [4, 10], 1, 0, -1, status => ({
            minusDiceHero: 1,
            isQuickAction: true,
            trigger: ['change-from'],
            exec: (_eStatus, execEvent = {}) => {
                const { changeHeroDiceCnt = 0 } = execEvent;
                if (changeHeroDiceCnt == 0) return { changeHeroDiceCnt }
                --status.useCnt;
                return { changeHeroDiceCnt: changeHeroDiceCnt - 1 }
            }
        })),

    2085: (icon = '') => new GIStatus(2085, '夜叉傩面', '所附属角色造成的[物理伤害]变为[风元素伤害]，且角色造成的[风元素伤害]+1。；【所附属角色进行[下落攻击]时：】伤害额外+2。；【所附属角色为出战角色，我方执行｢切换角色｣行动时：】少花费1个元素骰。(每回合1次)；【[持续回合]：{roundCnt}】',
        icon, 0, [4, 6, 8], -1, 0, 2, (status, event = {}) => {
            const { isFallAtk = false, trigger = '' } = event;
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isFallAtk, 2),
                minusDiceHero: status.perCnt,
                trigger: ['wind-dmg', 'change-from'],
                attachEl: 5,
                exec: (_eStatus, execEvent = {}) => {
                    if (trigger == 'change-from' && status.perCnt > 0) {
                        const { changeHeroDiceCnt = 0 } = execEvent;
                        if (changeHeroDiceCnt == 0) return { changeHeroDiceCnt }
                        --status.perCnt;
                        return { changeHeroDiceCnt: changeHeroDiceCnt - 1 }
                    }
                },
            }
        }, { icbg: STATUS_BG_COLOR[5], pct: 1 }),

    2086: () => new GIStatus(2086, '玉璋护盾', '为我方出战角色提供2点[护盾]。', '', 1, [7], 2, 0, -1),

    2087: (icon = '') => new GIStatus(2087, '石化', '【角色无法使用技能。】(持续到回合结束)', icon, 0, [3, 10, 14], -1, 0, 1, undefined, { icbg: DEBUFF_BG_COLOR }),

    2088: () => new GIStatus(2088, '蕴种印', '【任意具有蕴种印的所在阵营角色受到元素反应伤害后：】对所有附属角色1点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'sts2088', 0, [1], 2, 0, -1, (_status, event = {}) => {
            const { heros = [], eheros = [], hidx = -1 } = event;
            const hidxs: number[] = [];
            heros.forEach((h, hi) => {
                if (h.inStatus.some(ist => ist.id == 2088) && hi != hidx) {
                    hidxs.push(hi);
                }
            });
            const fhero = eheros.find(h => h.isFront);
            const hasEl2 = eheros.map(h => h.talentSlot).some(slot => slot?.id == 745) &&
                fhero?.outStatus?.some(ost => ost.id == 2089) &&
                eheros.filter(h => h.hp > 0).some(h => h.element == 2);
            if (!hasEl2 && hidx > -1) hidxs.push(hidx);
            return {
                damage: isCdt(hasEl2, 1),
                element: 7,
                pendamage: 1,
                isOppo: true,
                hidxs,
                trigger: ['get-elReaction'],
                exec: (eStatus, execEvent = {}) => {
                    const { heros = [] } = execEvent;
                    heros.forEach((h, hi) => {
                        if (hidxs.includes(hi)) {
                            const ist2088Idx = h.inStatus.findIndex(ist => ist.id == 2088);
                            if (ist2088Idx > -1) {
                                const ist2088 = h.inStatus[ist2088Idx];
                                --ist2088.useCnt;
                                if (ist2088.useCnt == 0 && hi != hidx) {
                                    h.inStatus.splice(ist2088Idx, 1);
                                }
                            }
                        }
                    });
                    if (hasEl2 && eStatus) --eStatus.useCnt;
                }
            }
        }, { icbg: DEBUFF_BG_COLOR }),

    2089: (icon = '', isTalent = false) => new GIStatus(2089, '摩耶之殿', '【我方引发元素反应时：】伤害额外+1。；【[持续回合]：{roundCnt}】',
        icon, 1, [6], -1, 0, isTalent ? 3 : 2, () => ({
            addDmgCdt: 1,
            trigger: ['elReaction'],
        }), { icbg: STATUS_BG_COLOR[7], isTalent }),

    2090: (useCnt = 0) => new GIStatus(2090, '流萤护罩', '为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【冰萤】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])',
        '', 1, [7], 1 + Math.min(3, useCnt), 0, -1),

    2091: () => new GIStatus(2091, '雷晶核心', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。',
        'heal2', 0, [10, 13], 1, 0, -1, () => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 1 }],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    2092: () => new GIStatus(2092, '火之新生', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到3点生命值。',
        'heal2', 0, [10, 13], 1, 0, -1, (_status, event = {}) => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 3 }],
            exec: eStatus => {
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                const { heros = [], hidx = -1 } = event;
                if (!heros[hidx]?.talentSlot) return;
                heros[hidx].talentSlot = null;
                return { inStatus: [heroStatus(2093)] }
            }
        })),

    2093: () => new GIStatus(2093, '渊火加护', '为所附属角色提供3点[护盾]。此[护盾]耗尽前，所附属角色造成的[火元素伤害]+1。',
        '', 0, [6, 7], 3, 0, -1, () => ({ addDmg: 1 })),

    2094: (expl?: ExplainContent[]) => new GIStatus(2094, '苍鹭护盾', '本角色将在下次行动时，直接使用技能：【苍鹭震击】。；【准备技能期间：】提供2点[护盾]，保护所附属角色。',
        '', 0, [7, 9, 11], 2, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 4,
            exec: () => {
                status.type.splice(status.type.indexOf(9), 1);
                status.useCnt = 0;
            }
        }), { expl }),

    2095: (icon = '', isTalent = false) => new GIStatus(2095, '赤冕祝祷', `我方角色｢普通攻击｣造成的伤害+1。；我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[水元素伤害]。；【我方切换角色后：】造成1点[水元素伤害]。(每回合1次)；${isTalent ? '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。(每回合1次)；' : ''}【[持续回合]：{roundCnt}】`,
        icon, 1, [1, 6, 8], -1, 0, 2, (status, event = {}) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const isWeapon = hidx > -1 && [1, 2, 5].includes(heros[hidx]?.weaponType ?? 0);
            let isDmg = true;
            const triggers: Trigger[] = ['skilltype1'];
            if (trigger == 'change-from') {
                isDmg = (status.perCnt >> 0 & 1) == 1;
                if (isDmg) triggers.push('change-from');
            } else if (trigger == 'after-skilltype1' && status.isTalent) {
                isDmg = (status.perCnt >> 1 & 1) == 1;
                if (isDmg) triggers.push('after-skilltype1');
            }
            return {
                trigger: triggers,
                addDmgType1: 1,
                damage: isCdt(isDmg, 1),
                element: 1,
                attachEl: isCdt(isWeapon, 1),
                exec: eStatus => {
                    const trg = ['change-from', 'after-skilltype1'].indexOf(trigger);
                    if (eStatus && trg > -1) eStatus.perCnt &= ~(1 << trg);
                },
            }
        }, { icbg: STATUS_BG_COLOR[1], pct: isTalent ? 3 : 1, isTalent }),

    2096: () => new GIStatus(2096, '丹火印', '【角色进行[重击]时：】造成的伤害+2。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
        'buff5', 0, [6], 1, 2, -1, (status, event = {}) => {
            if (!event.isChargedAtk) return;
            return {
                trigger: ['skilltype1'],
                addDmgCdt: 2,
                exec: () => { --status.useCnt },
            }
        }),

    2097: (icon = '') => new GIStatus(2097, '灼灼', '【角色进行[重击]时：】少花费1个[火元素骰]。(每回合1次)；【结束阶段：】角色附属【丹火印】。；【[持续回合]：{roundCnt}】',
        icon, 0, [3, 4], -1, 0, 2, (status, event = {}) => {
            const { isChargedAtk = false, trigger = '' } = event;
            const isMinus = isChargedAtk && status.perCnt > 0;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => isMinus);
            return {
                trigger: ['skilltype1', 'phase-end'],
                ...minusSkillRes,
                exec: () => {
                    if (trigger == 'phase-end') return { inStatus: [heroStatus(2096)] }
                    if (trigger == 'skilltype1' && isMinus && isMinusSkill) --status.perCnt;
                }
            }
        }, { icbg: STATUS_BG_COLOR[2], pct: 1 }),

    2098: (windEl = 5) => new GIStatus(2098, '乱岚拨止' + `${windEl < 5 ? '·' + ELEMENT[windEl][0] : ''}`,
        `【所附属角色进行[下落攻击]时：】造成的[物理伤害]变为[${ELEMENT[windEl]}伤害]，且伤害+1。；【角色使用技能后：】移除此效果。`,
        'buff', 0, [6, 10, 16], 1, 0, -1, (status, event = {}) => {
            const { isFallAtk = false } = event;
            return {
                addDmgCdt: isCdt(isFallAtk, 1),
                trigger: ['skill'],
                attachEl: isCdt(isFallAtk, STATUS_BG_COLOR.indexOf(status.iconBg)),
                exec: () => { --status.useCnt },
            }
        }, { icbg: STATUS_BG_COLOR[windEl] }),

    2099: (expl?: ExplainContent[]) => new GIStatus(2099, '引雷', '此状态初始具有2层｢引雷｣; 重复附属时，叠加1层｢引雷｣。｢引雷｣最多可以叠加到4层。；【结束阶段：】叠加1层｢引雷｣。；【所附属角色受到苍雷伤害时：】移除此状态，每层｢引雷｣使此伤害+1。',
        'debuff', 0, [6], 2, 4, -1, status => ({
            trigger: ['phase-end'],
            exec: () => { status.useCnt = Math.min(status.maxCnt, status.useCnt + 1) },
        }), { act: 1, expl }),

    2100: (icon = '') => new GIStatus(2100, '度厄真符', '【我方角色使用技能后：】如果该角色生命值未满，则治疗该角色2点。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 3, 0, -1, (_status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            const fhero = heros[hidx];
            const isHeal = (fhero?.hp ?? 0) < (fhero?.maxhp ?? 0);
            return {
                trigger: ['after-skill'],
                heal: isCdt(isHeal, 2),
                exec: eStatus => {
                    if (isHeal && eStatus) --eStatus.useCnt;
                }
            }
        }, { icbg: STATUS_BG_COLOR[4] }),

    2101: () => new GIStatus(2101, '拳力斗技！(生效中)', '【本回合中，一位牌手先宣布结束时：】未宣布结束的牌手摸2张牌。',
        'buff3', 0, [4, 10], 1, 0, -1, (_status, event = {}) => {
            const { phase = -1 } = event;
            return {
                trigger: ['any-end-phase'],
                cmds: [{ cmd: phase > 6 ? 'getCard-oppo' : 'getCard', cnt: 2 }],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    2102: () => new GIStatus(2102, '优风倾姿', '【所附属角色进行｢普通攻击｣时：】造成的伤害+2; 如果敌方存在后台角色，则此技能改为对下一个敌方后台角色造成伤害。；【[可用次数]：{useCnt}】',
        'buff5', 0, [6], 2, 0, -1, (status, event = {}) => ({
            addDmgType1: 2,
            trigger: ['skilltype1'],
            atkAfter: event.trigger == 'skilltype1',
            exec: () => { --status.useCnt },
        })),

    2103: () => new GIStatus(2103, '倾落', '下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。；【[可用次数]：{useCnt}】',
        'buff6', 0, [1, 4], 1, 0, -1, () => ({
            trigger: ['change-from'],
            damage: 1,
            element: 5,
            minusDiceHero: 1,
            exec: (eStatus, execEvent = {}) => {
                const { changeHeroDiceCnt = -1 } = execEvent;
                if (changeHeroDiceCnt > -1) {
                    if (changeHeroDiceCnt == 0) return { changeHeroDiceCnt }
                    return { changeHeroDiceCnt: changeHeroDiceCnt - 1 }
                }
                if (eStatus) --eStatus.useCnt;
            }
        })),

    2104: (icon = '') => new GIStatus(2104, '桂子仙机', '【我方切换角色后：】造成1点[草元素伤害]，治疗我方出战角色1点。；【[可用次数]：{useCnt}】',
        icon, 1, [1], 3, 0, -1, () => ({
            damage: 1,
            element: 7,
            heal: 1,
            trigger: ['change-from'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        }), { icbg: STATUS_BG_COLOR[7] }),

    2105: (summonId: number) => new GIStatus(2105, '净焰剑狱之护', '【迪希雅在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【迪希雅】生命值至少为7，则对其造成1点[穿透伤害]。',
        '', 1, [2], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0, heros = [] } = event;
            const hero = heros.find(h => h.id == 1209);
            if (restDmg <= 0 || !hero || heros[getAtkHidx(heros)]?.id == 1209) return { restDmg };
            --status.useCnt;
            return {
                pendamage: isCdt(hero.hp >= 7, 1),
                hidxs: isCdt(hero.hp >= 7, [heros.findIndex(h => h.id == 1209)]),
                restDmg: restDmg - 1,
            };
        }, { smnId: summonId }),

    2106: () => new GIStatus(2106, '烈烧佑命护盾', '为我方出战角色提供1点[护盾]。(可叠加，最多叠加到3点)', '', 1, [7], 1, 3, -1),

    2107: () => new GIStatus(2107, '奔潮引电', '本回合内所附属的角色｢普通攻击｣少花费1个[无色元素骰]。；【[可用次数]：{useCnt}】',
        'buff3', 0, [3, 4], 2, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
            return {
                trigger: ['skilltype1'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                }
            }
        }),

    2108: () => new GIStatus(2108, '协鸣之风', '本回合中，我方角色下次｢普通攻击｣少花费1个[无色元素骰]。',
        'buff3', 0, [3, 4, 10], 1, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
            return {
                trigger: ['skilltype1'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                }
            }
        }),

    2109: (expl?: ExplainContent[]) => new GIStatus(2109, '遣役之仪', '本回合中，所附属角色下次施放【野千役咒·杀生樱】时少花费2个元素骰。',
        'buff3', 0, [3, 4, 10], 1, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 2] });
            return {
                trigger: ['skilltype2'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                }
            }
        }, { expl }),

    2110: () => new GIStatus(2110, '琴音之诗(生效中)', '【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。',
        'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && card.subType.includes(1) && card.cost > mdc;
            return {
                minusDiceCard: isCdt(isMinus, 2),
                trigger: ['card'],
                exec: () => {
                    if (isMinus) --status.useCnt;
                },
            }
        }),

    2111: (icon = '') => new GIStatus(2111, '金杯的丰馈', '【敌方角色受到绽放反应时：】我方不再生成【草原核】，而是改为召唤【丰穰之核】。',
        icon, 1, [4, 10], -1, 0, -1, (_status, event = {}) => {
            const { isElStatus = [] } = event;
            return {
                trigger: ['get-elReaction-oppo'],
                summon: isCdt(isElStatus[0], [newSummonee(3043)]),
            }
        }, { icbg: STATUS_BG_COLOR[1], expl: [newSummonee(3043)] }),

    2112: (icon = '') => new GIStatus(2112, '永世流沔', '【结束阶段：】对所附属角色造成3点[水元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 0, [1], 1, 0, -1, () => ({
            damage: 3,
            element: 1,
            isOppo: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: DEBUFF_BG_COLOR }),

    2113: (icon = '') => new GIStatus(2113, '脉摄宣明', '【行动阶段开始时：】生成【无欲气护盾】。；【[可用次数]：{useCnt}】',
        icon, 1, [4], 2, 0, -1, (_status, event = {}) => ({
            trigger: ['phase-start'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                const { heros = [], hidx = -1 } = event;
                const isExist = heros[hidx]?.outStatus?.some(ost => ost.id == 2114);
                return { outStatus: [heroStatus(2114, isExist)] }
            },
        }), { icbg: STATUS_BG_COLOR[7], expl: [heroStatus(2114)] }),

    2114: () => new GIStatus(2114, '无欲气护盾', '提供1点[护盾]，保护我方出战角色。；【此效果被移除，或被重复生成时：】造成1点[草元素伤害]，治疗我方出战角色1点。',
        '', 1, [1, 7], 1, 0, -1, (status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            const fhero = heros[hidx];
            if (!fhero) throw new Error('hero not found');
            const triggers: Trigger[] = [];
            if (status.useCnt == 0) triggers.push('status-destroy');
            if (fhero.id == 1605) triggers.push('skilltype3');
            if (fhero.outStatus.some(ist => ist.id == 2113)) triggers.push('phase-start');
            const isTalent = !!heros.find(h => h.id == 1605)?.talentSlot;
            return {
                damage: 1,
                element: 7,
                heal: 1,
                trigger: triggers,
                cmds: isCdt(fhero.hp < fhero.maxhp && isTalent, [{ cmd: 'getDice', cnt: 1, element: -2 }]),
            }
        }),

    2115: (expl?: ExplainContent[]) => new GIStatus(2115, '降魔·忿怒显相', '【所附属角色使用风轮两立时：】少花费1个[风元素骰]。；【[可用次数]：{useCnt}】；【所附属角色不再附属夜叉傩面时：】移除此效果。',
        'buff2', 0, [3, 4], 2, 0, -1, (status, event = {}) => {
            const { heros = [], trigger = '' } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] });
            const hasSts2085 = heros?.find(h => h.id == 1404)?.inStatus?.find(ist => ist.id == 2085);
            const triggers: Trigger[] = ['skilltype2'];
            if (trigger == 'phase-end' && (hasSts2085?.roundCnt ?? 0) <= 1) triggers.push('phase-end');
            return {
                trigger: triggers,
                ...minusSkillRes,
                exec: () => {
                    if (trigger == 'phase-end') status.useCnt = 0;
                    else if (isMinusSkill) --status.useCnt;
                }
            }
        }, { expl }),

    2116: () => new GIStatus(2116, '本大爷还没有输！(冷却中)', '本回合无法再打出【本大爷还没有输！】。', 'debuff', 1, [3, 10], -1, 0, 1),

    2117: (expl?: ExplainContent[]) => new GIStatus(2117, '猜拳三连击·剪刀', '本角色将在下次行动时，直接使用技能：【猜拳三连击·剪刀】。',
        'buff3', 0, [10, 11], 1, 0, -1, (status, event = {}) => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 2,
            exec: () => {
                const { trigger = '' } = event;
                --status.useCnt;
                if (trigger == 'change-from') return;
                return { inStatus: [heroStatus(2118, [status.addition?.[0]])] }
            }
        }), { expl: [expl?.[0] as ExplainContent], add: [expl?.[1]] }),

    2118: (expl?: ExplainContent[]) => new GIStatus(2118, '猜拳三连击·布', '本角色将在下次行动时，直接使用技能：【猜拳三连击·布】。',
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 3,
            exec: () => { --status.useCnt },
        }), { expl }),

    2119: () => card751sts(1),

    2120: () => card751sts(2),

    2121: () => card751sts(3),

    2122: () => card751sts(4),

    2123: (icon = '', expl?: ExplainContent[]) => new GIStatus(2123, '焚落踢', '本角色将在下次行动时，直接使用技能：【焚落踢】。',
        icon, 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 5,
            exec: () => { --status.useCnt },
        }), { icbg: STATUS_BG_COLOR[2], expl }),

    2124: () => card587sts(1),

    2125: () => card587sts(2),

    2126: () => card587sts(3),

    2127: () => card587sts(4),

    2128: () => new GIStatus(2128, '安眠帷幕护盾', '为我方出战角色提供2点[护盾]。', '', 1, [7], 2, 0, -1),

    2129: (icon = '') => new GIStatus(2129, '飞星', '【我方角色使用技能后：】累积1枚｢晚星｣。；如果｢晚星｣已有至少4枚，则消耗4枚｢晚星｣，造成1点[冰元素伤害]。(生成此出战状态的技能，也会触发此效果)；【重复生成此出战状态时：】累积2枚｢晚星｣。',
        icon, 1, [1, 9], 1, 16, -1, (status, event = {}) => {
            const { heros = [], hidx = -1, trigger = '', card } = event;
            const addCnt = heros[hidx]?.id == 1009 && trigger == 'skilltype2' ? 2 : 0;
            const isDmg = status.useCnt + addCnt >= 4;
            return {
                trigger: [`${isDmg ? 'after-' : ''}skill`],
                damage: isCdt(isDmg, 1),
                element: 4,
                exec: eStatus => {
                    ++status.useCnt;
                    if (eStatus) {
                        eStatus.useCnt -= 4;
                        if (heros?.find(h => h.id == 1009)?.talentSlot || card?.id == 761) {
                            return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                        }
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[4], act: 2 }),

    2130: (act = 1) => new GIStatus(2130, '破局', '此状态初始具有1层｢破局｣; 重复附属时，叠加1层｢破局｣。｢破局｣最多可以叠加到3层。；【结束阶段：】叠加1层｢破局｣。；【所附属角色｢普通攻击｣时：】如果｢破局｣已有2层，则消耗2层｢破局｣，使造成的[物理伤害]转换为[水元素伤害]，并摸1张牌。',
        'buff', 0, [9, 16], 1, 3, -1, (status, event = {}) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (status.useCnt >= 2) triggers.push('skilltype1');
            return {
                trigger: triggers,
                attachEl: isCdt(status.useCnt >= 2 && trigger == 'skilltype1', 1),
                exec: () => {
                    if (trigger == 'skilltype1') {
                        status.useCnt -= 2;
                        return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                    }
                    if (trigger == 'phase-end') status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                }
            }
        }, { icbg: STATUS_BG_COLOR[1], act }),

    2131: (icon = '') => new GIStatus(2131, '玄掷玲珑', '【我方角色｢普通攻击｣后：】造成2点[水元素伤害]。；【[持续回合]：{roundCnt}】',
        icon, 1, [1], -1, 0, 2, () => ({
            damage: 2,
            element: 1,
            trigger: ['after-skilltype1'],
        }), { icbg: STATUS_BG_COLOR[1] }),

    2132: (expl?: ExplainContent[]) => new GIStatus(2132, '隐具余数', '｢隐具余数｣最多可以叠加到3层。；【角色使用眩惑光戏法时：】每层｢隐具余数｣使伤害+1。技能结算后，耗尽｢隐具余数｣，每层治疗角色1点。',
        'buff2', 0, [1, 6], 1, 3, -1, (status, event = {}) => ({
            trigger: ['skilltype2', 'after-skilltype2'],
            addDmgCdt: status.useCnt,
            heal: isCdt(event.trigger == 'after-skilltype2', status.useCnt),
            exec: eStatus => {
                if (eStatus) eStatus.useCnt = 0;
            }
        }), { expl }),

    2133: () => new GIStatus(2133, '攻袭余威', '【结束阶段：】如果角色生命值至少为6，则受到2点[穿透伤害]。；【[持续回合]：{roundCnt}】',
        'debuff', 0, [1, 3], 1, 0, 1, (_status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            return {
                trigger: isCdt(heros[hidx].hp >= 6, ['phase-end']),
                pendamage: 2,
                hidxs: [hidx],
                isOppo: true,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    2134: (summonId: number) => new GIStatus(2134, '惊奇猫猫盒的嘲讽', '【我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)',
        '', 1, [2], 1, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: restDmg - 1 };
        }, { smnId: summonId }),

    2135: (icon = '') => new GIStatus(2135, '大将旗指物', '我方角色造成的[岩元素伤害]+1。；【[持续回合]：{roundCnt}】(可叠加，最多叠加到3回合)',
        icon, 0, [3, 6], -1, 3, 2, (_status, event = {}) => {
            const { isSkill = -1 } = event;
            return {
                trigger: isSkill > -1 ? ['rock-dmg'] : [],
                addDmgCdt: 1,
            }
        }, { icbg: STATUS_BG_COLOR[6] }),

    2136: (icon = '', rcnt = 2) => new GIStatus(2136, '琢光镜', '角色造成的[物理伤害]变为[草元素伤害]。；【角色｢普通攻击｣后：】造成1点[草元素伤害]。如果此技能为[重击]，则使此状态的[持续回合]+1。；【[持续回合]：{roundCnt}】(可叠加，最多叠加到3回合)',
        icon, 0, [1, 8], -1, 3, rcnt, (status, event = {}) => {
            const { isChargedAtk = false, trigger = '' } = event;
            return {
                attachEl: 7,
                trigger: ['skilltype1', 'after-skilltype1'],
                damage: isCdt(trigger == 'after-skilltype1', 1),
                element: 7,
                exec: () => {
                    if (isChargedAtk) {
                        status.roundCnt = Math.min(status.maxCnt, status.roundCnt + 1);
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[7] }),

    2137: (type = 0, isExpl = true) => new GIStatus(2137, ['严寒', '炽热'][type], `【结束阶段：】对所附属角色造成1点[${['冰', '火'][type]}元素伤害]。；【[可用次数]：{useCnt}】；所附属角色被附属【${['炽热', '严寒'][type]}】时，移除此效果。`,
        ELEMENT_ICON[[4, 2][type]] + '-dice', 0, [1], 1, 0, -1, status => ({
            damage: 1,
            element: status.perCnt == 0 ? 4 : 2,
            isOppo: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        }), { icbg: DEBUFF_BG_COLOR, pct: -type, expl: isExpl ? [heroStatus(2137, type ^ 1, false)] : [] }),

    2138: (icon = '') => new GIStatus(2138, '冰封的炽炎魔女', '【行动阶段开始时：】如果所附属角色生命值不多于4，则移除此效果。；【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。【此效果被移除时：】所附属角色转换为[｢焚尽的炽炎魔女｣]形态。',
        icon, 0, [4, 10, 13], 1, 0, -1, (_status, event = {}) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['will-killed', 'skilltype3'];
            if ((heros[hidx]?.hp ?? 10) <= 4) triggers.push('phase-start');
            return {
                trigger: triggers,
                cmds: isCdt(trigger == 'will-killed', [{ cmd: 'revive', cnt: 1 }]),
                exec: eStatus => {
                    if (eStatus) {
                        --eStatus.useCnt;
                        return;
                    }
                    return { cmds: [{ cmd: 'changePattern', cnt: 1851, hidxs: [hidx] }] }
                }
            }
        }, { icbg: STATUS_BG_COLOR[4] }),

    2139: (cnt = 1) => new GIStatus(2139, '炎之魔蝎·守势', '【附属角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', 0, [2], cnt, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: restDmg - 1 };
        }),

    2140: (icon = '') => new GIStatus(2140, '雷霆探针', '【所在阵营角色使用技能后：】对所在阵营出战角色附属【雷鸣探知】。(每回合1次)',
        icon, 1, [10], -1, 0, -1, status => ({
            trigger: ['skill'],
            exec: () => {
                if (status.perCnt <= 0) return;
                --status.perCnt;
                return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2141)] }] }
            }
        }), { icbg: DEBUFF_BG_COLOR, pct: 1, expl: [heroStatus(2141)] }),

    2141: () => new GIStatus(2141, '雷鸣探知', '【所附属角色受到雷音权现及其召唤物造成的伤害时：】移除此状态，使此伤害+1。；(同一方场上最多存在一个此状态。【雷音权现】的部分技能，会以所附属角色为目标。)',
        'debuff', 0, [6, 10], 1, 0, -1, (status, event = {}) => {
            const { dmgSource = 0, eheros = [] } = event;
            const getDmg = dmgSource == 1762 || dmgSource == 3052 ? 1 : 0;
            const talent = eheros.find(h => h.id == 1762)?.talentSlot;
            return {
                trigger: ['getdmg'],
                getDmg,
                onlyOne: true,
                exec: () => {
                    if (getDmg > 0) --status.useCnt;
                    if (talent && talent.useCnt > 0) {
                        --talent.useCnt;
                        return { cmds: [{ cmd: 'getCard-oppo', cnt: 1 }] }
                    }
                }
            }
        }, { isReset: false }),

    2142: () => new GIStatus(2142, '坍毁', '所附属角色受到的[物理伤害]或[风元素伤害]+2。；【[可用次数]：{useCnt}】',
        'debuff', 0, [6], 1, 0, -1, (status, event = {}) => {
            const { heros = [], hidx = -1, eheros = [] } = event;
            return {
                trigger: ['any-getdmg', 'wind-getdmg'],
                getDmg: 2,
                exec: () => {
                    --status.useCnt;
                    const talent = eheros.find(h => h.id == 1782)?.talentSlot;
                    if (status.useCnt == 0 && talent && talent.useCnt > 0) {
                        --talent.useCnt;
                        const all = allHidxs(heros);
                        const hidxs = [all[(all.indexOf(hidx) + 1) % all.length]];
                        return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2142)], hidxs }] }
                    }
                }
            }
        }),

    2143: (expl?: ExplainContent[]) => new GIStatus(2143, '风龙吐息', '本角色将在下次行动时，直接使用技能：【长延涤流】。',
        'buff3', 0, [11], 1, 0, -1, (status, event = {}) => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 6,
            exec: () => {
                const { trigger = '' } = event;
                --status.useCnt;
                if (trigger == 'change-from') return;
                return { inStatus: [heroStatus(2144, [status.explains?.[1]])] }
            }
        }), { expl }),

    2144: (expl?: ExplainContent[]) => new GIStatus(2144, '风龙吐息', '本角色将在下次行动时，直接使用技能：【终幕涤流】。',
        'buff3', 0, [11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 7,
            exec: () => { --status.useCnt },
        }), { expl }),

    2145: (icon = '') => new GIStatus(2145, '磐岩百相·元素凝晶', '【角色受到‹4冰›/‹1水›/‹2火›/‹3雷›元素伤害后：】如果角色当前未汲取该元素的力量，则移除此状态，然后角色[汲取对应元素的力量]。',
        icon, 0, [10], 1, 0, -1, (status, event = {}) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const hero = heros[hidx];
            const curEl = hero.srcs.indexOf(hero.src);
            const drawEl = ELEMENT_ICON.indexOf(trigger.split('-')[0]);
            return {
                trigger: ['ice-getdmg', 'water-getdmg', 'fire-getdmg', 'thunder-getdmg'],
                exec: () => {
                    if (curEl != drawEl) {
                        --status.useCnt;
                        const sts2153 = hero.inStatus.find(ist => ist.id == 2153);
                        if (!sts2153) throw new Error('status not found');
                        return { ...heroStatus(2153).handle(sts2153, { ...event, trigger: `el6Reaction:${drawEl}` as Trigger })?.exec?.() }
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[6] }),

    2146: () => new GIStatus(2146, '裁定之时(生效中)', '本回合中，我方打出的事件牌无效。；【[可用次数]：{useCnt}】',
        'debuff', 1, [4], 3, 0, 1, (status, event = {}) => {
            const { card } = event;
            const isInvalid = card?.type == 2;
            return {
                trigger: ['card'],
                isInvalid,
                exec: () => {
                    if (isInvalid) --status.useCnt;
                }
            }
        }),

    2147: () => new GIStatus(2147, '坍陷与契机(生效中)', '【本回合中，双方牌手进行｢切换角色｣行动时：】需要额外花费1个元素骰。',
        'debuff', 1, [4, 10], -1, 0, 1, () => ({ trigger: ['change-from'], addDiceHero: 1 })),


    2148: () => new GIStatus(2148, '野猪公主(生效中)', '【本回合中，我方每有一张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。；【[可用次数]：{useCnt}】；(角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果)',
        'buff2', 1, [4], 2, 0, 1, (status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            return {
                trigger: ['slot-destroy'],
                exec: () => {
                    let cnt = 0;
                    if (heros[hidx].weaponSlot != null) ++cnt;
                    if (heros[hidx].artifactSlot != null) ++cnt;
                    if (heros[hidx].talentSlot != null) ++cnt;
                    cnt = Math.max(1, Math.min(2, cnt));
                    status.useCnt -= cnt;
                    return { cmds: [{ cmd: 'getDice', cnt, element: 0 }] }
                }
            }
        }),

    2149: () => new GIStatus(2149, '沙海守望·主动出击', '本回合内，所附属角色下次造成的伤害额外+1。',
        'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
            trigger: ['skill'],
            addDmg: 1,
            exec: () => { --status.useCnt }
        })),

    2150: () => new GIStatus(2150, '沙海守望·攻势防御', '本回合内，所附属角色下次造成的伤害额外+1。',
        'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
            trigger: ['skill'],
            addDmg: 1,
            exec: () => { --status.useCnt }
        })),

    2151: () => new GIStatus(2151, '四叶印(生效中)', '【结束阶段：】切换到所附属角色。',
        'buff3', 0, [3, 10], -1, 0, -1, (_status, event = {}) => ({
            trigger: ['phase-end'],
            exec: () => {
                const { hidx = -1 } = event;
                return { cmds: [{ cmd: 'switch-to-self', hidxs: [hidx], cnt: 1100 }] }
            }
        })),

    2152: () => new GIStatus(2152, '炸鱼薯条(生效中)', '本回合中，所附属角色下次使用技能时少花费1个元素骰。',
        'buff2', 0, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] });
            return {
                trigger: ['skill'],
                ...minusSkillRes,
                exec: () => {
                    if (isMinusSkill) --status.useCnt;
                },
            }
        }),

    2153: (expl?: ExplainContent[]) => new GIStatus(2153, '磐岩百相·元素汲取', '角色可以汲取‹4冰›/‹1水›/‹2火›/‹3雷›元素的力量，然后根据所汲取的元素类型，获得技能‹4霜刺破袭›/‹1洪流重斥›/‹2炽焰重斥›/‹3霆雷破袭›。(角色同时只能汲取一种元素，此状态会记录角色已汲取过的元素类型数量)；【角色汲取了一种和当前不同的元素后：】生成1个所汲取元素类型的元素骰。',
        'buff2', 0, [9, 12], 0, 4, -1, (status, event = {}) => ({
            trigger: ['el6Reaction'],
            exec: () => {
                const { heros = [], hidx = -1, trigger = '' } = event;
                const hero = heros[hidx];
                const curEl = hero.srcs.indexOf(hero.src);
                const drawEl = trigger.startsWith('el6Reaction') ? Number(trigger.slice(trigger.indexOf(':') + 1)) : 0;
                if (drawEl == 0 || drawEl == curEl) return;
                const isDrawed = status.perCnt != 0;
                hero.src = hero.srcs[drawEl];
                let els = -status.perCnt;
                if ((els >> drawEl - 1 & 1) == 0) {
                    els |= 1 << drawEl - 1;
                    ++status.useCnt;
                    status.perCnt = -els;
                }
                const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, element: drawEl }, { cmd: 'getSkill', hidxs: [hidx], cnt: 7 + drawEl, element: 2 }];
                if (isDrawed) cmds.splice(1, 0, { cmd: 'loseSkill', hidxs: [hidx], element: 2 });
                return { cmds }
            }
        }), { expl }),

    2154: (icon = '', isTalent = false) => new GIStatus(2154, '炽火大铠', '【我方角色｢普通攻击｣后：】造成1点[火元素伤害]，生成【烈烧佑命护盾】。；【[可用次数]：{useCnt}】',
        icon, 1, [1], isTalent ? 3 : 2, 0, -1, (_status: Status) => ({
            damage: 1,
            element: 2,
            trigger: ['after-skilltype1'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                return { cmds: [{ cmd: 'getOutStatus', status: [heroStatus(2106)] }] }
            },
        }), { icbg: STATUS_BG_COLOR[2], expl: [heroStatus(2106)], isTalent }),

    2155: (windEl = 0, expl?: ExplainContent[]) => new GIStatus(2155, '风风轮', '本角色将在下次行动时，直接使用技能：【风风轮舞踢】。',
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 12 + Number(status.addition[0]),
            exec: () => { --status.useCnt },
        }), { expl, add: [windEl] }),

    2156: () => new GIStatus(2156, '四迸冰锥', '【我方角色｢普通攻击｣时：】对所有敌方后台角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'buff6', 0, [], 1, 0, -1, status => ({
            pendamage: 1,
            trigger: ['skilltype1'],
            exec: () => { --status.useCnt },
        })),

    2157: () => new GIStatus(2157, '冰晶核心', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。',
        'heal2', 0, [10, 13], 1, 0, -1, (_status, event = {}) => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 1 }],
            exec: eStatus => {
                const { heros = [], hidx = -1 } = event;
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                if (!heros[hidx].talentSlot) return;
                return { inStatusOppo: [heroStatus(2137)] }
            }
        })),

    2158: (isTalent = false, useCnt = 2, addCnt?: number) => new GIStatus(2158, '原海明珠', `【所附属角色受到伤害时：】抵消1点伤害。；【每回合${isTalent ? 2 : 1}次：】抵消来自召唤物的伤害时不消耗[可用次数]。；【[可用次数]：{useCnt}】；【我方宣布结束时：】如果所附属角色为｢出战角色｣，则摸1张牌。`,
        '', 0, [2, 4], useCnt, 0, -1, (status, event = {}) => {
            const { restDmg = 0, heros = [], hidx = -1, dmgSource = -1 } = event;
            if (restDmg > 0) {
                if (Math.floor(dmgSource / 1000) == 3 && status.perCnt > 0) --status.perCnt;
                else --status.useCnt;
                return { restDmg: restDmg - 1 }
            }
            return {
                restDmg,
                trigger: ['end-phase'],
                cmds: isCdt(heros[hidx].isFront, [{ cmd: 'getCard', cnt: 1 }]),
            }
        }, { isTalent, pct: isTalent ? 2 : 1, act: addCnt }),

    2159: () => new GIStatus(2159, '松茸酿肉卷(生效中)', '3回合内结束阶段再治疗此角色1点。',
        'heal', 0, [3], 3, 0, -1, (_status, event = {}) => {
            const { hidx = -1 } = event;
            return {
                trigger: ['phase-end'],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                    return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
                },
            }
        }),

    2160: () => new GIStatus(2160, '原木刀(生效中)', '【角色在本回合中，下次使用｢普通攻击｣后：】生成2个此角色类型的元素骰。',
        'buff2', 0, [3, 4, 10], 1, 0, 1, status => ({
            trigger: ['skilltype1'],
            exec: () => {
                --status.useCnt;
                return { cmds: [{ cmd: 'getDice', element: -2, cnt: 2 }] }
            }
        })),

    2161: () => new GIStatus(2161, '净觉花(生效中)', '【本回合中，我方下次打出支援牌时：】少花费1个元素骰。',
        'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && card.type == 1 && card.cost > mdc;
            return {
                minusDiceCard: isCdt(isMinus, 1),
                trigger: ['card'],
                exec: () => {
                    if (isMinus) --status.useCnt;
                },
            }
        }),

    2162: () => new GIStatus(2162, '机关铸成之链(生效中)', '【所附属角色每次受到伤害或治疗后：】累积1点｢备战度｣(最多累积2点)。；【我方打出费用不多于｢备战度｣的｢武器｣或｢圣遗物｣时:】移除此状态，以免费打出该牌。',
        'buff3', 1, [4, 9], 0, 0, -1, (status, event = {}) => {
            const { card, trigger = '', heal = [], hidx = -1, minusDiceCard: mdc = 0 } = event;
            const isMinus = card && card.subType.some(st => st < 2) && card.cost > mdc && status.useCnt >= card.cost - mdc;
            return {
                trigger: ['getdmg', 'heal', 'card'],
                minusDiceCard: isMinus ? card.cost - mdc : 0,
                exec: () => {
                    if (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0) {
                        status.useCnt = Math.min(2, status.useCnt + 1);
                    } else if (trigger == 'card' && isMinus) {
                        status.type.pop();
                        status.useCnt = 0;
                    }
                }
            }
        }),

    2163: () => new GIStatus(2163, '瞬时剪影', `【结束阶段：】对所附属角色造成1点[冰元素伤害]; 如果[可用次数]仅剩余1且所附属角色具有[冰元素附着]，则此伤害+1。；【[可用次数]：{useCnt}】`,
        'ice-dice', 0, [1], 2, 0, -1, (status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            const isAddDmg = heros[hidx]?.attachElement.includes(4) && status.useCnt == 1;
            return {
                damage: isCdt(isAddDmg, 2, 1),
                element: 4,
                isOppo: true,
                trigger: ['phase-end'],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                },
            }
        }, { icbg: DEBUFF_BG_COLOR }),

    2164: (expl?: ExplainContent[], cnt = 1) => new GIStatus(2164, '源水之滴', `【那维莱特进行｢普通攻击｣后：】治疗角色2点，然后角色[准备技能]：【衡平推裁】。；【[可用次数]：{useCnt}(可叠加，最多叠加到3次)】`,
        'sts2164', 1, [1], cnt, 3, -1, (status, event = {}) => {
            const { heros = [], hidx = -1 } = event;
            if (heros[hidx]?.id != 1110) return;
            return {
                heal: 2,
                trigger: ['after-skilltype1'],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                    return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2165, status.explains)] }] }
                },
            }
        }, { expl }),

    2165: (expl?: ExplainContent[]) => new GIStatus(2165, '衡平推裁', `本角色将在下次行动时，直接使用技能：【衡平推裁】。`,
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 17,
            exec: () => { --status.useCnt },
        }), { expl }),

    2166: () => new GIStatus(2166, '遗龙之荣', '角色造成的伤害+1。【[可用次数]:{useCnt}】',
        'buff2', 0, [4, 6], 2, 0, -1, status => ({
            addDmg: 1,
            trigger: ['skill'],
            exec: () => { --status.useCnt },
        })),

    2167: (icon = '') => new GIStatus(2167, '猫箱急件', '【绮良良为出战角色时，我方切换角色后：】造成1点[草元素伤害]，摸1张牌。；【[可用次数]：{useCnt}(可叠加，最多叠加到2次)】',
        icon, 1, [1], 1, 2, -1, (_status, event = {}) => {
            const { heros = [], force = false } = event;
            if (!heros.find(h => h.id == 1607)?.isFront && !force) return;
            return {
                damage: 1,
                element: 7,
                trigger: ['change-from'],
                exec: eStatus => {
                    if (!eStatus) return;
                    --eStatus.useCnt;
                    return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                },
            }
        }, { icbg: STATUS_BG_COLOR[7] }),

    2168: () => new GIStatus(2033, '安全运输护盾', '为我方出战角色提供2点[护盾]。', '', 1, [7], 2, 0, -1),

    2169: (icon = '') => new GIStatus(2169, '猫草豆蔻', '【所在阵营打出2张行动牌后：】对所在阵营的出战角色造成1点[草元素伤害]。；【[可用次数]：{useCnt}】',
        icon, 1, [1, 4], 2, 0, -1, status => ({
            damage: isCdt(status.perCnt <= -1, 1),
            element: 7,
            isOppo: true,
            trigger: ['card'],
            exec: eStatus => {
                --status.perCnt;
                if (eStatus) {
                    --eStatus.useCnt;
                    eStatus.perCnt = 0;
                }
            },
        }), { icbg: DEBUFF_BG_COLOR }),

    2170: (useCnt = 0) => new GIStatus(2170, '雷萤护罩', '为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【雷萤】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])',
        '', 1, [7], 1 + Math.min(3, useCnt), 0, -1),

    2171: (expl?: ExplainContent[]) => new GIStatus(2171, '霆电迸发', '本角色将在下次行动时，直接使用技能：【霆电迸发】。',
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 18,
            exec: () => { --status.useCnt },
        }), { expl }),

    2172: () => new GIStatus(2172, '万世的浪涛', '角色在本回合中，下次造成的伤害+2。',
        'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
            addDmg: 2,
            trigger: ['skill'],
            exec: () => { --status.useCnt },
        })),

    2173: () => new GIStatus(2173, '抗争之日·碎梦之时(生效中)', '本回合中，所附属角色受到的伤害-1。；【[可用次数]：{useCnt}】',
        '', 0, [2], 4, 0, 1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg };
            --status.useCnt;
            return { restDmg: Math.max(0, restDmg - 1) };
        }),

    2174: () => new GIStatus(2174, '严格禁令', '本回合中，所在阵营打出的事件牌无效。；【[可用次数]：{useCnt}】',
        'debuff', 1, [4], 1, 0, 1, (status, event = {}) => {
            const { card } = event;
            const isInvalid = card?.type == 2;
            return {
                trigger: ['card'],
                isInvalid,
                exec: () => {
                    if (isInvalid) --status.useCnt;
                }
            }
        }),

    2175: (expl?: ExplainContent[]) => new GIStatus(2175, '雷压', '每当我方累积打出3张行动牌，就会触发敌方场上【雷萤】的效果。(使【雷萤】的[可用次数]+1)',
        'debuff', 1, [4, 9], 0, 3, -1, (status, event = {}) => ({
            trigger: ['card'],
            exec: () => {
                const { esummons = [] } = event;
                status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                const summon = esummons.find(smn => smn.id == status.summonId);
                if (summon && summon.useCnt < 3) {
                    ++summon.useCnt;
                    status.useCnt = 0;
                }
            },
        }), { expl }),

    2176: (icon = '') => new GIStatus(2176, '越袚草轮', '【我方切换角色后：】造成1点[雷元素伤害]，治疗受伤最多的我方角色1点。(每回合1次)；【[可用次数]：{useCnt}】',
        icon, 1, [1], 3, 0, -1, (status, event = {}) => {
            if (status.perCnt == 0) return;
            return {
                damage: 1,
                element: 3,
                heal: 1,
                hidxs: getMinhpHidxs(event.heros ?? []),
                trigger: ['change-from'],
                exec: eStatus => {
                    if (eStatus) {
                        --eStatus.useCnt;
                        --eStatus.perCnt;
                    }
                }
            }
        }, { icbg: STATUS_BG_COLOR[3], pct: 1 }),

    2177: (icon = '') => new GIStatus(2177, '疾风示现', '【所附属角色进行[重击]时：】少花费1个[无色元素骰]，造成的[物理伤害]变为[风元素伤害]，并且使敌方出战角色附属【风压坍陷】；【[可用次数]：{useCnt}】',
        icon, 0, [4, 16], 1, 0, -1, (status, event = {}) => {
            if (!event.isChargedAtk) return;
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
            return {
                trigger: ['skilltype1'],
                ...minusSkillRes,
                attachEl: 5,
                exec: () => {
                    --status.useCnt;
                    return { inStatusOppo: [heroStatus(2178)] }
                }
            }
        }, { icbg: STATUS_BG_COLOR[5], expl: [heroStatus(2178)] }),

    2178: () => new GIStatus(2178, '风压坍陷', '【结束阶段：】将附属角色切换为｢出战角色｣。；【[可用次数]：{useCnt}】；(同一方场上最多存在一个此状态)',
        'buff3', 0, [3], 1, 0, -1, (_status, event = {}) => ({
            trigger: ['phase-end'],
            onlyOne: true,
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                const { hidx = -1 } = event;
                return { cmds: [{ cmd: 'switch-to-self', hidxs: [hidx], cnt: 1100 }] }
            }
        })),

    2179: (expl?: ExplainContent[]) => new GIStatus(2179, '涟锋旋刃', '本角色将在下次行动时，直接使用技能：【涟锋旋刃】。',
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 19,
            exec: () => { --status.useCnt },
        }), { expl }),

    2180: () => new GIStatus(2180, '暗流的诅咒', '【所在阵营的角色使用｢元素战技｣或｢元素爆发｣时：】需要多花费1个元素骰。；【[可用次数]：{useCnt}】',
        'debuff', 1, [4], 2, 0, -1, status => ({
            trigger: ['skilltype2', 'skilltype3'],
            addDiceSkill: {
                skilltype2: [0, 0, 1],
                skilltype3: [0, 0, 1],
            },
            exec: () => { --status.useCnt },
        })),

    2181: () => new GIStatus(2181, '水之新生', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。触发此效果后，角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。',
        'heal2', 0, [10, 13], 1, 0, -1, () => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 4 }],
            exec: eStatus => {
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2187)] }] }
            }
        })),

    2182: (useCnt = 1) => new GIStatus(2182, '重甲蟹壳', '每层提供1点[护盾]，保护所附属角色。', '', 0, [7], useCnt, 100, -1),

    2183: (expl?: ExplainContent[]) => new GIStatus(2183, '炽烈轰破', '本角色将在下次行动时，直接使用技能：【炽烈轰破】。',
        'buff3', 0, [10, 11], 1, 0, -1, status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 20,
            exec: () => { --status.useCnt },
        }), { expl }),

    2184: () => new GIStatus(2184, '悠远雷暴', '【结束阶段：】对所附属角色造成2点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'debuff', 0, [1], 1, 0, -1, (_status, event = {}) => {
            const { hidx = -1 } = event;
            return {
                trigger: ['phase-end'],
                pendamage: 2,
                hidxs: [hidx],
                isOppo: true,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    2185: () => new GIStatus(2185, '清洁工作todo名字待定', '所附属角色下次造成的伤害+1。；【[可用次数]：{useCnt}(可叠加，最多叠加到2)】',
        'buff5', 0, [4, 6], 1, 2, 1, status => ({
            trigger: ['skill'],
            addDmg: 1,
            exec: () => { --status.useCnt },
        })),

    2186: () => new GIStatus(2186, '缤纷马卡龙(生效中)', '该角色受到伤害后再治疗其1点。',
        'heal', 0, [1], 3, 0, -1, () => ({
            heal: 1,
            trigger: ['getdmg'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    2187: () => new GIStatus(2187, '水之新生后续todo名字待定', '角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。',
        'buff4', 0, [6, 8, 10], 1, 0, -1, () => ({ attachEl: 1, addDmg: 1 })),

    2188: () => new GIStatus(2188, '沙与梦', '【对角色打出｢天赋｣或角色使用技能时：】少花费3个元素骰。；【[可用次数]：{useCnt}】',
        'buff2', 0, [4], 1, 0, -1, (status, event = {}) => {
            const { card, heros = [], hidx = -1, trigger = '', minusDiceCard: mdc = 0 } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 3] });
            const isCardMinus = card && card.subType.includes(6) && card.userType == heros[hidx]?.id && card.cost > mdc;
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isCardMinus, 3),
                trigger: ['card', 'skill'],
                exec: () => {
                    if (trigger == 'card' && isCardMinus || trigger == 'skill' && isMinusSkill) --status.useCnt;
                },
            }
        }),

};

export const heroStatus = (id: number, ...args: any) => statusTotal[id](...args);