import { ELEMENT_ICON } from "./constant";
import { heroStatus } from "./heroStatus";
import { allHidxs, getAtkHidx, getMinhpHidxs, getNearestHidx, isCdt, minusDiceSkillHandle } from "./utils";

class GISummonee implements Summonee {
    id: number;
    name: string;
    description: string;
    src: string = '';
    useCnt: number;
    maxUse: number;
    shield: number;
    damage: number;
    pendamage: number;
    element: number;
    isDestroy: number;
    perCnt: number;
    isTalent: boolean;
    statusId: number;
    addition: string[];
    handle: (summon: Summonee, smnOpt?: SummonOption) => SummonHandleRes;
    descriptions: string[] = [];
    isSelected: boolean = false;
    canSelect: boolean = false;
    isWill: boolean = false;
    constructor(
        id: number, name: string, description: string, src: string, useCnt: number, maxUse: number,
        shield: number, damage: number, element: number, handle?: (summon: Summonee, smnOpt?: SummonOption) => SummonHandleRes,
        options: { pct?: number, isTalent?: boolean, adt?: string[], pdmg?: number, isDestroy?: number, stsId?: number, spReset?: boolean } = {}
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.src = src;
        this.useCnt = useCnt;
        this.maxUse = maxUse;
        this.shield = shield;
        this.damage = damage;
        this.element = element;
        const { pct = 0, isTalent = false, adt = [], pdmg = 0, isDestroy = 0, stsId = -1, spReset = false } = options;
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        this.pendamage = pdmg;
        this.isDestroy = isDestroy;
        this.statusId = stsId;
        this.handle = ((summon: Summonee, smnOpt?: SummonOption): SummonHandleRes => {
            const { reset = false } = smnOpt ?? {};
            if (reset) {
                summon.perCnt = pct;
                if (!spReset) return {}
            }
            return handle?.(summon, smnOpt) ?? {
                trigger: ['phase-end'],
                exec: (execOpt: SummonExecOption) => {
                    const { summon: smn = summon } = execOpt;
                    return phaseEndAtk(smn);
                },
            }
        });
    }
}

type SummoneeObj = {
    [id: string]: (...args: any) => GISummonee
}

const phaseEndAtk = (summon: Summonee, healHidxs?: number[]): SummonHandleRes => {
    if (summon.isDestroy == 0) summon.useCnt = Math.max(0, summon.useCnt - 1);
    const cmds: Cmds[] = [];
    if (summon.damage > 0) cmds.push({ cmd: 'attack' });
    if (summon.shield > 0) cmds.push({ cmd: 'heal', hidxs: healHidxs });
    return { cmds }
}

const summonTotal: SummoneeObj = {
    3000: () => new GISummonee(3000, '', '', '', -1, -1, -1, 0, 0, () => ({})),

    3001: () => new GISummonee(3001, '冰灵珠', '【结束阶段：】造成{dmg}点[冰元素伤害]，对所有后台敌人造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/07c346ef7197c24c76a25d3b47ed5e66_3626039813983519562.png',
        2, 2, 0, 1, 4, undefined, { pdmg: 1 }),

    3002: () => new GISummonee(3002, '燃烧烈焰', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
        'https://patchwiki.biligame.com/images/ys/8/8b/2nnf0b70wnuaw0yn45i9db61l6dwg9x.png',
        1, 2, 0, 1, 2),

    3003: () => new GISummonee(3003, '霜见雪关扉', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/0e04dc93febea28566d127704a0eef5c_8035762422701723644.png',
        2, 2, 0, 2, 4),

    3004: () => new GISummonee(3004, '虚影', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段：】弃置此牌，造成{dmg}点[水元素伤害]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/098f3edd0f9ac347a9424c6417de6987_7446453175998729325.png',
        1, 1, -1, 1, 1, (summon: Summonee) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => phaseEndAtk(smnexeOpt?.summon ?? summon),
        }), { isDestroy: 2, stsId: 2013 }),

    3005: (isTalent = false) => new GISummonee(3005, '大型风灵', `【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)${isTalent ? '；此召唤物在场时：如果此牌的元素已转换，则使我方造成的此类元素伤害+1。' : ''}`,
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9ed867751e0b4cbb697279969593a81c_1968548064764444761.png',
        3, 3, 0, 2, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '' } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            const changeElTrg = ELEMENT_ICON[summon.element] + '-dmg';
            if (summon.element == 5) triggers.push('el5Reaction');
            const isTalent = summon.isTalent && summon.element < 5 && trigger == changeElTrg;
            if (isTalent) triggers.push(changeElTrg);
            return {
                trigger: triggers,
                isNotAddTask: isTalent || trigger.startsWith('el5Reaction'),
                addDmgCdt: isCdt(isTalent, 1),
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
                        const element = Number(trigger.slice(trigger.indexOf(':') + 1));
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                    return {};
                }
            }
        }, { isTalent }),

    3006: () => new GISummonee(3006, '蒲公英领域', '【结束阶段：】造成{dmg}点[风元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/13c4609aff96cf57ad218ddf954ecc08_1272742665837129862.png',
        2, 2, 1, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '' } = smnOpt;
            const isTalent = !!heros.find(h => h.id == 1402)?.talentSlot;
            return {
                trigger: ['phase-end', 'wind-dmg'],
                isNotAddTask: trigger == 'wind-dmg',
                addDmgCdt: isCdt(isTalent, 1),
                exec: (smnexeOpt: SummonExecOption) => {
                    if (trigger == 'wind-dmg') return {}
                    return phaseEndAtk(smnexeOpt?.summon ?? summon);
                }
            }
        }),

    3007: () => new GISummonee(3007, '锅巴', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/19b63677c8f4e6cabed15711be406e09_2795447472820195792.png',
        2, 2, 0, 2, 2),

    3008: (isTalent = false) => new GISummonee(3008, '奥兹', `【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】${isTalent ? '；【菲谢尔】｢普通攻击｣后：造成2点[雷元素伤害]。(需消耗可用次数)' : ''}`,
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/ea0ab20ac46c334e1afd6483b28bb901_2978591195898491598.png',
        2, 2, 0, 1, 3, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '', isExec = true } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            let cnt = isCdt(trigger != 'phase-end', 2);
            if (heros[getAtkHidx(heros)]?.id == 1301 && summon.isTalent) {
                triggers.push('after-skilltype1');
                if (!isExec && trigger == 'after-skilltype1') --summon.useCnt;
            }
            return {
                trigger: triggers,
                damage: cnt,
                element: summon.element,
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', cnt }] };
                },
            }
        }, { isTalent }),

    3009: () => new GISummonee(3009, '柯里安巴', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/4562f5108720b7a6048440a1b86c963d_9140007412773415051.png',
        2, 2, 0, 2, 7),

    3010: () => new GISummonee(3010, '水丘丘萨满', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/1fc573971ff6d8a6ede47f966be9a6a9_2274801154807218394.png',
        2, 2, 0, 1, 1),

    3011: () => new GISummonee(3011, '冲锋丘丘人', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/b2751af5c3dddc5a4bf7909bd2382adc_8142471467728886523.png',
        2, 2, 0, 1, 2),

    3012: () => new GISummonee(3012, '雷箭丘丘人', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/084fbb351267f4a6eb5b4eb167cebe51_7018603863032841385.png',
        2, 2, 0, 1, 3),

    3013: () => new GISummonee(3013, '冰箭丘丘人', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/ba55e6e19d419b16ec763dfcfb655834_213836850123099432.png',
        2, 2, 0, 1, 4),

    3014: () => new GISummonee(3014, '酒雾领域', '【结束阶段：】造成{dmg}点[冰元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/a8a7cc75353c6df3921b63e42f46fe7d_3484731987232379289.png',
        2, 2, 2, 1, 4),

    3015: () => new GISummonee(3015, '歌声之环', '【结束阶段：】治疗所有我方角色{shield}点，然后对我方出战角色[附着水元素]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d406a937bb6794a26ac46bf1fc9cfe3b_7906063991052689263.png',
        2, 2, 1, 0, 1, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { summon: smn = summon } = smnexeOpt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'heal', hidxs: allHidxs(smnOpt.heros), isAttach: true }] }
            }
        })),

    3016: () => new GISummonee(3016, '纯水幻形·花鼠', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9c9ed1587353d9e563a2dee53ffb0e2a_5326741860473626981.png',
        2, 2, 0, 2, 1),

    3017: () => new GISummonee(3017, '纯水幻形·飞鸢', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
        'http://taim.3vhost.club/geniusInovakation/mihoyo_chunshui_feiyuan.png',
        3, 3, 0, 1, 1),

    3018: () => new GISummonee(3018, '纯水幻形·蛙', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以造成{dmg}点[水元素伤害]。',
        'http://taim.3vhost.club/geniusInovakation/mihoyo_chunshui_wa.png',
        1, 1, -1, 2, 1, (summon: Summonee) => {
            const trigger: Trigger[] = [];
            if (summon.useCnt == 0) trigger.push('phase-end');
            return {
                trigger,
                exec: (smnexeOpt: SummonExecOption) => phaseEndAtk(smnexeOpt?.summon ?? summon),
            }
        }, { isDestroy: 1, stsId: 2042 }),

    3019: () => new GISummonee(3019, '剑影·孤风', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/90767acfd11dc25ae46a333557b3ee2a_4658043205818200753.png',
        2, 2, 0, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '', heros = [] } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            if (heros.find(h => h.id == 1781)?.isFront) triggers.push('after-skilltype3')
            return {
                trigger: triggers,
                damage: summon.damage,
                element: summon.element,
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack' }] }
                },
            }
        }),

    3020: () => new GISummonee(3020, '剑影·霜驰', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3f77ab65d8d940df9b3cf70d96ae0b25_8204101439924542003.png',
        2, 2, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '', heros = [] } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            if (heros.find(h => h.id == 1781)?.isFront) triggers.push('after-skilltype3')
            return {
                trigger: triggers,
                damage: summon.damage,
                element: summon.element,
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack' }] }
                },
            }
        }),

    3021: () => new GISummonee(3021, '天狗咒雷·伏', '【结束阶段：】造成{dmg}点[雷元素伤害]，我方出战角色附属【鸣煌护持】。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/aef9cba89ecb16fa0d73ffef53cad44e_6822516960472237055.png',
        1, 1, 0, 1, 3, (summon: Summonee) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { cmds = [] } = phaseEndAtk(smnexeOpt?.summon ?? summon);
                return {
                    cmds: [...cmds, { cmd: 'getInStatus', status: [heroStatus(2064)] }],
                }
            }
        })),

    3022: () => new GISummonee(3022, '天狗咒雷·雷砾', '【结束阶段：】造成{dmg}点[雷元素伤害]，我方出战角色附属【鸣煌护持】。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/51bca1f202172ad60abbace59b96c346_7973049003331786903.png',
        2, 2, 0, 2, 3, (summon: Summonee) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { cmds = [] } = phaseEndAtk(smnexeOpt?.summon ?? summon);
                return {
                    cmds: [...cmds, { cmd: 'getInStatus', status: [heroStatus(2064)] }],
                }
            }
        })),

    3023: (useCnt = 2) => new GISummonee(3023, '化海月', '【结束阶段：】造成{dmg}点[水元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/4608304a2a01f7f33b59b731543a761b_3713077215425832494.png',
        useCnt, 2, 1, 1, 1, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { summon: smn = summon } = smnexeOpt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const { heros = [] } = smnOpt;
                const hero = heros.find(h => h.id == 1104);
                const isTalent = !!hero?.talentSlot && hero?.inStatus?.some(ist => ist.id == 2065);
                return {
                    cmds: [
                        { cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) },
                        { cmd: 'heal' }
                    ]
                }
            }
        })),

    3024: () => new GISummonee(3024, '光降之剑', '【优菈使用｢普通攻击｣或｢元素战技｣时：】此牌累积2点｢能量层数｣，但是【优菈】不会获得[充能]。；【结束阶段：】弃置此牌。造成{dmg}点[物理伤害]; 每有1点｢能量层数｣，都使次伤害+1。(影响此牌｢[可用次数]｣的效果会作用于｢能量层数｣。)',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/a475346a830d9b62d189dc9267b35a7a_4963009310206732642.png',
        0, 100, 0, 3, 0, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '' } = smnOpt;
            return {
                trigger: ['phase-end', 'skilltype1', 'skilltype2'],
                isNotAddTask: trigger != 'phase-end',
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') {
                        return { cmds: [{ cmd: 'attack', cnt: smn.damage + smn.useCnt }] };
                    }
                    const hero = heros[getAtkHidx(heros)];
                    if (hero?.id == 1006) {
                        const cnt = hero.talentSlot != null && trigger == 'skilltype2' ? 3 : 2
                        smn.useCnt += cnt;
                        return { cmds: [{ cmd: 'getEnergy', cnt: -1 }] }
                    }
                    return {}
                },
            }
        }, { adt: ['plus'], isDestroy: 2 }),

    3025: () => new GISummonee(3025, '清净之园囿', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色｢普通攻击｣造成的伤害+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ef32ccb60a38cb7bfa31372dd5953970_1908841666370199656.png',
        2, 2, 0, 2, 1, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            addDmgType1: 1,
            trigger: ['phase-end', 'skilltype1'],
            exec: (smnexeOpt: SummonExecOption) => {
                if (smnOpt?.trigger == 'phase-end') return phaseEndAtk(smnexeOpt?.summon ?? summon);
                return {}
            },
        })),

    3026: () => new GISummonee(3026, '阿丑', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【此召唤物在场期间可触发1次：】我方角色受到伤害后，为【荒泷一斗】附属【乱神之怪力】。；【结束阶段：】弃置此牌，造成{dmg}点[岩元素伤害]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/9beb8c255664a152c8e9ca35697c7d9e_263220232522666772.png',
        1, 1, -1, 1, 6, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '' } = smnOpt;
            const hidx = heros.findIndex(h => h.id == 1503 && h.hp > 0);
            return {
                trigger: ['phase-end', 'getdmg'],
                isNotAddTask: trigger == 'getdmg',
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (smn.perCnt <= 0 || trigger != 'getdmg' || hidx == -1) return {}
                    --smn.perCnt;
                    return {
                        cmds: [{
                            cmd: 'getInStatus',
                            status: [heroStatus(2068)],
                            hidxs: [hidx],
                        }]
                    }
                },
            }
        }, { pct: 1, isDestroy: 2, stsId: 2070 }),

    3027: () => new GISummonee(3027, '藏蕴花矢', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/dc8e548704ca0e52d1c6669fac469b3d_5168805556784249785.png',
        1, 2, 0, 1, 7),

    3028: () => new GISummonee(3028, '箓灵', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】；【召唤物在场时：】敌方角色受到的[冰元素伤害]和[物理伤害]+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/7deee3f26916cf28fd145b110f81d852_4270139379454156566.png',
        2, 2, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '' } = smnOpt;
            return {
                addDmgCdt: 1,
                isNotAddTask: trigger != 'phase-end',
                trigger: ['ice-getdmg-oppo', 'any-getdmg-oppo', 'phase-end'],
                exec: (smnexeOpt: SummonExecOption) => {
                    if (trigger == 'phase-end') return phaseEndAtk(smnexeOpt?.summon ?? summon);
                    return {}
                },
            }
        }),

    3029: () => new GISummonee(3029, '兔兔伯爵', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以造成{dmg}点[火元素伤害]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/6864ff4d13f55e24080152f88fef542f_1635591582740112856.png',
        1, 1, -2, 2, 2, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '', isExec = true } = smnOpt;
            const triggers: Trigger[] = [];
            if (summon.useCnt == 0) triggers.push('phase-end');
            const hero = heros[getAtkHidx(heros)];
            const cnt = isCdt(hero?.id == 1206 && trigger == 'after-skilltype1' && !!hero?.talentSlot, 4);
            if (cnt) {
                triggers.push('after-skilltype1');
                if (!isExec) {
                    summon.isDestroy = 0;
                    summon.useCnt = 0;
                }
            }
            return {
                trigger: triggers,
                damage: cnt,
                element: summon.element,
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'after-skilltype1') {
                        smn.isDestroy = 0;
                        smn.useCnt = 0;
                    }
                    return { cmds: [{ cmd: 'attack', cnt }] }
                },
            }
        }, { isDestroy: 1, stsId: 2077 }),

    3030: () => new GISummonee(3030, '雷罚恶曜之眼', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色｢元素爆发｣造成的伤害+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/a27cfa39a258ff4b80f01b1964e6faac_1649452858766133852.png',
        3, 3, 0, 1, 3, (summon: Summonee) => ({
            addDmgType3: 1,
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => phaseEndAtk(smnexeOpt?.summon ?? summon),
        })),

    3031: () => new GISummonee(3031, '杀生樱', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到6次)；【我方宣布结束时：】如果此牌的[可用次数]至少为4，则造成1点[雷元素伤害]。(需消耗[可用次数])',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/d63267f4388f521b1481a85ace6de257_3147336152102036232.png',
        3, 6, 0, 1, 3, (summon: Summonee) => {
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 4) triggers.push('end-phase');
            return {
                trigger: triggers,
                exec: (smnexeOpt: SummonExecOption) => phaseEndAtk(smnexeOpt?.summon ?? summon),
            }
        }),

    3032: () => new GISummonee(3032, '暴风之眼', '【结束阶段：】造成{dmg}点[风元素伤害]，对方切换到[距离我方出战角色最近的角色]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/b0b8a8e9a43548bc39fceba101ea0ab6_1760632395524982528.png',
        2, 2, 0, 2, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '' } = smnOpt;
            const hidx = heros.findIndex(h => h.isFront);
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == 5) triggers.push('el5Reaction');
            return {
                trigger: triggers,
                isNotAddTask: trigger.startsWith('el5Reaction'),
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') {
                        smn.useCnt = Math.max(0, smn.useCnt - 1);
                        return { cmds: [{ cmd: 'attack' }, { cmd: 'switch-to', hidxs: [hidx], cnt: 2500 }] };
                    }
                    if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
                        const element = Number(trigger.slice(trigger.indexOf(':') + 1));
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                    return {};
                }
            }
        }),

    3033: () => new GISummonee(3033, '岩脊', '【结束阶段：】造成{dmg}点[岩元素伤害]。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/251c5e32d6cbdfb4c4d0e14e7088ab67_7008401766526335309.png',
        2, 2, 0, 1, 6),

    3034: () => new GISummonee(3034, '冰萤', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)；【愚人众·冰萤术士｢普通攻击｣后：】此牌[可用次数]+1。；【愚人众·冰萤术士受到元素反应伤害后：】此牌[可用次数]-1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/e98436c034423b951fb726977b37f6b1_915982547283319448.png',
        2, 3, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '', heros = [], hcard, isExec = true } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            const hero = heros[getAtkHidx(heros)];
            const cnt = Number(trigger.slice(-1));
            const isTalent = !isNaN(cnt) && hero?.id == 1701 && (!!hero?.talentSlot || hcard?.id == 746) && summon.useCnt + cnt > summon.maxUse;
            if (hero?.id == 1701) {
                triggers.push('skilltype1', 'get-elReaction', 'after-skilltype1');
                if (isTalent && trigger == 'after-skilltype2') {
                    triggers.push('after-skilltype2');
                }
                if (!isExec) {
                    if (['after-skilltype1', 'after-skilltype2'].includes(trigger)) {
                        summon.useCnt = Math.max(summon.useCnt, Math.min(summon.maxUse, summon.useCnt + 1));
                    }
                    if (trigger == 'get-elReaction') {
                        summon.useCnt = Math.max(0, summon.useCnt - 1);
                    }
                }
            }
            return {
                trigger: triggers,
                damage: isCdt(isTalent, 2),
                element: summon.element,
                isNotAddTask: !isTalent && trigger != 'phase-end',
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger.startsWith('after-skilltype')) {
                        if (isTalent || trigger == 'after-skilltype1') smn.useCnt = Math.max(smn.useCnt, Math.min(smn.maxUse, smn.useCnt + 1));
                        if (isTalent) return { cmds: [{ cmd: 'attack', cnt: 2 }] }
                        return {}
                    }
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (trigger == 'phase-end') return { cmds: [{ cmd: 'attack' }] }
                    return {}
                }
            }
        }),

    3035: () => new GISummonee(3035, '雷锁镇域', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】敌方执行｢切换角色｣行动的元素骰费用+1。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/8df8ffcdace3033ced5ccedc1dc7da68_5001323349681512527.png',
        2, 2, 0, 1, 3, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '' } = smnOpt;
            return {
                addDiceHero: summon.perCnt,
                isNotAddTask: trigger != 'phase-end',
                trigger: ['phase-end', 'change-oppo'],
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon, changeHeroDiceCnt = 0 } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger == 'change-oppo' && smn.perCnt > 0) {
                        --smn.perCnt;
                        return { changeHeroDiceCnt: changeHeroDiceCnt + 1 }
                    }
                    return { changeHeroDiceCnt }
                }
            }
        }, { pct: 1 }),

    3036: () => new GISummonee(3036, '黯火炉心', '【结束阶段：】造成{dmg}点[火元素伤害]，对所有敌方后台角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/68087eeb0ffed52029a7ad3220eb04db_2391994745432576824.png',
        2, 2, 0, 1, 2, undefined, { pdmg: 1 }),

    3037: () => new GISummonee(3037, '流风秋野', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/8296c70266ae557b635c27b20e2fd615_5814665570399175790.png',
        3, 3, 0, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '' } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == 5) triggers.push('el5Reaction');
            return {
                trigger: triggers,
                isNotAddTask: trigger.startsWith('el5Reaction'),
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
                        const element = Number(trigger.slice(trigger.indexOf(':') + 1));
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                    return {};
                }
            }
        }),

    3038: () => new GISummonee(3038, '蔷薇雷光', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/0ea69a82861d8469ecdbbc78797e9fd8_3713104012683105893.png',
        2, 2, 0, 2, 3),

    3039: () => new GISummonee(3039, '寒病鬼差', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时，七七使用｢普通攻击｣后：】治疗受伤最多的我方角色1点。',
        'https://act-upload.mihoyo.com/ys-obc/2023/08/16/12109492/f9ea7576630eb5a8c46aae9ea8f61c7b_317750933065064305.png',
        3, 3, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '', isExec = false } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            const hidxs = getMinhpHidxs(heros);
            const isHeal = heros[getAtkHidx(heros)]?.id == 1008 && trigger == 'skilltype1' && hidxs.length > 0;
            if (isHeal) triggers.push('skilltype1');
            const cmds: Cmds[] = [{ cmd: 'heal', cnt: 1, hidxs }];
            return {
                trigger: triggers,
                cmds: isCdt(isHeal && !isExec, cmds),
                exec: (smnexeOpt: SummonExecOption) => {
                    if (trigger == 'phase-end') return phaseEndAtk(smnexeOpt?.summon ?? summon);
                    if (trigger == 'skilltype1') return { cmds }
                    return {}
                },
            }
        }),

    3040: () => new GISummonee(3040, '阳华', '【结束阶段：】造成{dmg}点[岩元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色进行[下落攻击]时少花费1个[无色元素骰]。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/5e2b48f4db9bfae76d4ab9400f535b4f_1116777827962231889.png',
        3, 3, 0, 1, 6, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { isFallAtk = false, trigger = '' } = smnOpt;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(smnOpt, { skilltype1: [0, 1, 0] },
                () => isFallAtk && summon.perCnt > 0);
            return {
                ...minusSkillRes,
                isNotAddTask: trigger == 'skilltype1',
                trigger: ['skilltype1', 'phase-end'],
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger == 'skilltype1' && isMinusSkill) --smn.perCnt;
                    return {}
                }
            }
        }, { pct: 1 }),

    3041: () => new GISummonee(3041, '净焰剑狱领域', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】；【当此召唤物在场且迪希雅在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【迪希雅】生命值至少为7，则对其造成1点[穿透伤害]。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/5fe195423d5308573221c9d25f08d6d7_2012000078881285374.png',
        3, 3, 0, 1, 2, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { reset = false } = smnOpt;
            if (reset) return { rOutStatus: [heroStatus(2105, 3041)] }
            return {
                trigger: ['phase-end'],
                exec: (smnexeOpt: SummonExecOption) => phaseEndAtk(smnexeOpt?.summon ?? summon),
            }
        }, { spReset: true }),

    3042: (isTalent = false) => new GISummonee(3042, '月桂·抛掷型', `【结束阶段：】造成{dmg}点[草元素伤害]，治疗我方受伤最多的角色{shield}点。${isTalent ? '；如果可用次数仅剩余1，则此效果造成的伤害和治疗各+1。' : ''}；【[可用次数]：{useCnt}】`,
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/7bc79d56afd059a2f88d45ae0c500923_7487275599868058123.png',
        2, 2, 1, 1, 7, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { heros = [] } = smnOpt;
                const { summon: smn = summon } = smnexeOpt;
                const isLast = smn.isTalent && smn.useCnt == 1;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const cmds: Cmds[] = [{ cmd: 'attack', cnt: isCdt(isLast, smn.damage + 1) }];
                const hidxs = getMinhpHidxs(heros);
                if (hidxs.length > 0) cmds.push({ cmd: 'heal', cnt: isCdt(isLast, smn.shield + 1), hidxs });
                return { cmds }
            }
        }), { isTalent }),

    3043: () => new GISummonee(3043, '丰穰之核', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)；【我方宣布结束时：】如果此牌的[可用次数]至少为2，则造成2点[草元素伤害]。(需消耗[可用次数])',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/865915f8734cdc641df43198eb728497_5603461429712047360.png',
        1, 3, 0, 2, 7, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [] } = smnOpt;
            const hero = heros.find(h => h.id == 1108);
            const isTalent = !!hero?.talentSlot;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 2) triggers.push('end-phase');
            return {
                trigger: triggers,
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) }] };
                },
            }
        }),

    3044: () => new GISummonee(3044, '售后服务弹', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/fe4516935ffa9eb9b193411113fa823f_372775257521707079.png',
        1, 1, 0, 1, 3),

    3045: (isTalent = false) => new GISummonee(3045, '灯中幽精', `【结束阶段：】治疗我方出战角色{shield}点，并使其获得1点[充能]。${isTalent ? '；治疗生命值不多于6的角色时，治疗量+1; 使没有[充能]的角色获得[充能]时，获得量+1。' : ''}；【[可用次数]：{useCnt}】`,
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c8209ff8f2c21e01e4e05203385410d7_8366905551575281519.png',
        2, 2, 2, 0, 0, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { summon: smn = summon } = smnexeOpt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const { heros = [] } = smnOpt;
                const fhero = heros.find(h => h.isFront);
                if (!fhero) throw new Error('fhero is undefined');
                return {
                    cmds: [
                        { cmd: 'heal', cnt: isCdt(fhero.hp <= 6 && smn.isTalent, smn.shield + 1) },
                        { cmd: 'getEnergy', cnt: fhero.energy == 0 && smn.isTalent ? 2 : 1 }
                    ]
                }
            }
        }), { isTalent, adt: isTalent ? ['plus'] : [] }),

    3046: () => new GISummonee(3046, '游丝徵灵', '【结束阶段：】造成{dmg}点[草元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/42b6402e196eec814b923ac88b2ec3e6_7208177288974921556.png',
        1, 1, 1, 1, 7),

    3047: () => new GISummonee(3047, '饰梦天球', '【结束阶段：】造成{dmg}点[冰元素伤害]。如果【飞星】在场，则使其累积1枚｢晚星｣。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/1b86f1cb97411b77d51cc22bb5622ff7_2462971599599504312.png',
        2, 2, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { summon: smn = summon } = smnexeOpt;
                const { heros = [] } = smnOpt;
                const sts2129 = heros.find(h => h.isFront)?.outStatus?.find(ost => ost.id == 2129);
                if (sts2129) ++sts2129.useCnt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'attack' }] }
            }
        })),

    3048: () => new GISummonee(3048, '怪笑猫猫帽', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/27885c0d6d1bd4ae42ea0d69d357198d_8888407409706694377.png',
        1, 2, 0, 1, 2, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { summon: smn = summon } = smnexeOpt;
                const { heros = [] } = smnOpt;
                const talent = heros.find(h => h.id == 1210)?.talentSlot;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                if (talent && talent.useCnt > 0) {
                    --talent.useCnt;
                    return { cmds: [{ cmd: 'attack', cnt: smn.damage + 2 }] }
                }
                return { cmds: [{ cmd: 'attack' }] }
            }
        })),

    3049: () => new GISummonee(3049, '惊奇猫猫盒', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【当此召唤物在场，我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)；【我方角色受到‹4冰›/‹1水›/‹2火›/‹3雷›元素伤害时：】转换此牌的元素类型，改为造成所受到的元素类型的伤害。（离场前仅限一次）',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/18e98a957a314ade3c2f0722db5a36fe_4019045966791621132.png',
        2, 2, 0, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { reset = false, trigger = '' } = smnOpt;
            if (reset) return { rOutStatus: [heroStatus(2134, 3049)] }
            const getdmg = ['water-getdmg', 'fire-getdmg', 'thunder-getdmg', 'ice-getdmg'];
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == 5 && getdmg.includes(trigger)) {
                triggers.push(trigger);
            }
            return {
                trigger: triggers,
                isNotAddTask: trigger.includes('-getdmg'),
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.includes('-getdmg') && smn.element == 5) {
                        const element = ELEMENT_ICON.indexOf(trigger.slice(0, trigger.indexOf('-getdmg')));
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                    return {};
                },
            }
        }, { spReset: true }),


    3050: () => new GISummonee(3050, '大将威仪', '【结束阶段：】造成{dmg}点[岩元素伤害]；如果队伍中存在2名‹6岩元素›角色，则生成【结晶】。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/669b37ae522405031419cd14f6e8daf0_5829987868413544081.png',
        2, 2, 0, 1, 6, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { cmds = [] } = phaseEndAtk(smnexeOpt?.summon ?? summon);
                const { heros = [] } = smnOpt;
                if (heros.filter(h => h.element == 6).length >= 2) {
                    cmds.push({ cmd: 'getOutStatus', status: [heroStatus(2007)] })
                }
                return { cmds }
            }
        })),

    3051: (isTalent = false) => new GISummonee(3051, '厄灵·炎之魔蝎', `【结束阶段：】造成{dmg}点[火元素伤害]${isTalent ? '; 如果本回合中【镀金旅团·炽沙叙事人】使用过｢普通攻击｣或｢元素战技｣，则此伤害+1' : ''}。；【[可用次数]：{useCnt}】；【入场时和行动阶段开始：】使我方【镀金旅团·炽沙叙事人】附属【炎之魔蝎·守势】。(【厄灵·炎之魔蝎】在场时每回合至多${isTalent ? 2 : 1}次，使角色受到的伤害-1。)`,
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8bb20558ca4a0f53569eb23a7547bdff_6164361177759522363.png',
        2, 2, 0, 1, 2, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { heros = [], trigger = '' } = smnOpt;
            const hidx = heros.findIndex(h => h.id == 1743 && h.hp > 0);
            return {
                trigger: ['phase-end', 'phase-start'],
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon } = smnexeOpt;
                    if (trigger == 'phase-end') {
                        smn.useCnt = Math.max(0, smn.useCnt - 1);
                        let addDmg = 0;
                        if (hidx > -1) {
                            const hero = heros[hidx];
                            addDmg = smn.isTalent && hero.skills.some(sk => sk.type < 3 && sk.useCnt > 0) ? 1 : 0;
                        }
                        return { cmds: [{ cmd: 'attack', cnt: smn.damage + addDmg }] }
                    }
                    if (trigger == 'phase-start' && hidx > -1) {
                        return { cmds: [{ cmd: 'getInStatus', status: [heroStatus(2139, smn.isTalent ? 2 : 1)], hidxs: [hidx] }] }
                    }
                    return {}
                },
            }
        }, { isTalent, adt: isTalent ? ['plus'] : [] }),

    3052: () => new GISummonee(3052, '轰雷禁锢', '【结束阶段：】对附属【雷鸣探知】的敌方角色造成{dmg}点[雷元素伤害]。(如果敌方不存在符合条件角色，则改为对出战角色造成伤害)；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/552ec062eef427f9a1986f92ee19c716_8843394885297317371.png',
        1, 1, 0, 3, 3, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { eheros = [] } = smnOpt;
            const sts2141 = eheros.findIndex(h => h.inStatus.some(ist => ist.id == 2141));
            const hidxs = isCdt(sts2141 > -1, [sts2141]);
            return {
                trigger: ['phase-end'],
                exec: () => {
                    summon.useCnt = Math.max(0, summon.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', hidxs }] }
                },
            }
        }),

    3053: () => new GISummonee(3053, '不倒貉貉', `【结束阶段：】造成{dmg}点[风元素伤害]，治疗我方受伤最多的角色{shield}点。；【[可用次数]：{useCnt}】`,
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/e78e66eddfb70ab60a6f4d3733a8c3ab_4021248491292359775.png',
        2, 2, 2, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { heros = [] } = smnOpt;
                const { summon: smn = summon } = smnexeOpt;
                return phaseEndAtk(smn, getMinhpHidxs(heros));
            }
        })),

    3054: () => new GISummonee(3054, '刺击冰棱', `【结束阶段：】对敌方[距离我方出战角色最近的角色]造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】`,
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/7becac09916614d57a2f084749634d5d_3605800251898465783.png',
        2, 2, 0, 1, 4, (summon: Summonee, smnOpt: SummonOption = {}) => ({
            trigger: ['phase-end'],
            exec: (smnexeOpt: SummonExecOption) => {
                const { heros = [], eheros = [] } = smnOpt;
                const { summon: smn = summon } = smnexeOpt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'attack', hidxs: [getNearestHidx(heros.findIndex(h => h.isFront), eheros)] }] }
            }
        })),

    3055: () => new GISummonee(3055, '共鸣珊瑚珠', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/5776f31ac915874cb7eadd77a0098839_1777069343038822943.png',
        2, 2, 0, 1, 3),

    3056: () => new GISummonee(3056, '临事场域', '【结束阶段：】造成{dmg}点[冰元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/a4249ebb8a68e2843cdd2fa78937912c_2796631322062911422.png',
        2, 2, 1, 1, 4),

    3057: () => new GISummonee(3057, '雷萤', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【敌方累积打出3张行动牌后：】此牌[可用次数]+1。(最多叠加到3)；【愚人众·雷萤术士受到元素反应伤害后：】此牌[可用次数]-1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b49d5bd6e23362e65f2819b62c1752f6_652290106975576928.png',
        3, 3, 0, 1, 3, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '', heros = [], isExec = true } = smnOpt;
            const triggers: Trigger[] = ['phase-end'];
            const hero = heros.find(h => h.id == 1764);
            if (hero?.isFront) {
                triggers.push('get-elReaction');
                if (!isExec && trigger == 'get-elReaction') {
                    summon.useCnt = Math.max(0, summon.useCnt - 1);
                }
            }
            if ((hero?.talentSlot?.useCnt ?? 0) > 0 && summon.useCnt >= 3) triggers.push('action-start');
            return {
                trigger: triggers,
                damage: 1,
                element: 3,
                isNotAddTask: trigger == 'get-elReaction',
                exec: (smnexeOpt: SummonExecOption) => {
                    const { summon: smn = summon, heros: hrs = heros, eheros = [] } = smnexeOpt;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (smn.useCnt == 0) {
                        const eOutStatus = eheros.find(h => h.isFront)?.outStatus;
                        const sts2175 = eOutStatus?.findIndex(ist => ist.id == 2175) ?? -1;
                        if (sts2175 > -1) eOutStatus?.splice(sts2175, 1);
                    }
                    if (trigger == 'get-elReaction') return {}
                    const chero = hrs.find(h => h.id == 1764);
                    if (trigger == 'action-start' && chero?.talentSlot) --chero.talentSlot.useCnt;
                    return { cmds: [{ cmd: 'attack' }] }
                }
            }
        }),

    3058: (isTalent = false) => new GISummonee(3058, '赫耀多方面体', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】敌方角色受到的[风元素伤害]+1。',
        '',
        3, 3, 0, 1, 5, (summon: Summonee, smnOpt: SummonOption = {}) => {
            const { trigger = '' } = smnOpt;
            const triggers: Trigger[] = ['wind-getdmg-oppo', 'phase-end'];
            if (summon.isTalent) triggers.push('phase-start');
            return {
                addDmgCdt: 1,
                isNotAddTask: trigger == 'wind-getdmg-oppo',
                trigger: triggers,
                exec: (smnexeOpt: SummonExecOption) => {
                    if (trigger == 'phase-end') return phaseEndAtk(smnexeOpt?.summon ?? summon);
                    if (trigger == 'phase-start') return { cmds: [{ cmd: 'getDice', cnt: 1, element: 5 }] }
                    return {}
                },
            }
        }, { isTalent }),

    3059: () => new GISummonee(3059, '愤怒的太郎丸', '【结束阶段：】造成{dmg}点[物理伤害]。；【[可用次数]：{useCnt}】',
        '',
        2, 2, 0, 2, 0),

}

export const newSummonee = (id: number, ...args: any) => summonTotal[id](...args);