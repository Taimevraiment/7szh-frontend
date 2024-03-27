import { cardsTotal } from './cards';
import { ELEMENT_ICON } from './constant';
import { heroStatus } from './heroStatus';
import { newSummonee } from './summonee';
import { allHidxs, isCdt, minusDiceSkillHandle } from './utils';

class GISite implements Site {
    id: number;
    sid: number;
    card: Card;
    cnt: number;
    perCnt: number;
    hpCnt: number;
    type: number;
    handle: (site: Site, siteOption?: SiteOption) => SiteHandleRes;
    isSelected: boolean = false;
    canSelect: boolean = false;
    constructor(id: number, cardId: number, cnt: number, perCnt: number, type: number, handle: (site: Site, siteOption?: SiteOption) => SiteHandleRes, hpCnt = 0) {
        this.id = id;
        this.sid = Math.floor(Math.random() * 1000);
        this.card = cardsTotal(cardId);
        this.cnt = cnt;
        this.perCnt = perCnt;
        this.type = type;
        this.hpCnt = hpCnt;
        this.handle = (site: Site, siteOption?: SiteOption): SiteHandleRes => {
            const { reset = false } = siteOption ?? {};
            if (reset && perCnt > 0) {
                site.perCnt = perCnt;
                return {}
            }
            return handle(site, siteOption);
        };
    }
}

type SiteObj = {
    [id: string]: (...args: any) => GISite
}

const siteTotal: SiteObj = {
    // 派蒙
    4001: (cardId: number) => new GISite(4001, cardId, 2, 0, 1, (site: GISite) => ({
        trigger: ['phase-start'],
        exec: () => {
            --site.cnt;
            return { cmds: [{ cmd: 'getDice', cnt: 2, element: 0 }], isDestroy: site.cnt == 0 }
        }
    })),
    // 参量质变仪
    4002: (cardId: number) => new GISite(4002, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { isSkill = -1 } = options;
        if (isSkill == -1) return {}
        return {
            trigger: ['el-dmg', 'el-getdmg'],
            siteCnt: site.cnt < 2 ? 1 : -3,
            exec: () => {
                if (++site.cnt < 3) return { isDestroy: false }
                return { cmds: [{ cmd: 'getDice', cnt: 3, element: -1 }], isDestroy: true }

            }
        }
    }),
    // 璃月港口
    4003: (cardId: number) => new GISite(4003, cardId, 2, 0, 1, (site: GISite) => ({
        trigger: ['phase-end'],
        exec: () => {
            --site.cnt;
            return { cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: site.cnt == 0 }
        }
    })),
    // 常九爷
    4004: (cardId: number) => new GISite(4004, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { isSkill = -1 } = options;
        if (isSkill == -1) return {}
        return {
            trigger: ['any-dmg', 'any-getdmg', 'pen-dmg', 'pen-getdmg', 'elReaction', 'get-elReaction'],
            siteCnt: site.cnt < 2 ? 1 : -3,
            isOrTrigger: true,
            exec: () => {
                if (++site.cnt < 3) return { isDestroy: false }
                return { cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: true }
            }
        }
    }),
    // 立本
    4005: (cardId: number) => new GISite(4005, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { dices = [], trigger } = options;
        return {
            trigger: ['phase-end', 'phase-start'],
            exec: () => {
                if (trigger == 'phase-end') {
                    const tmpdices: number[] = [];
                    const newdices: number[] = [];
                    while (dices.length > 0) {
                        const dice = dices.pop() ?? 0;
                        if (dice > 0 && tmpdices.includes(dice) || site.cnt >= 3) {
                            newdices.push(dice);
                        } else {
                            ++site.cnt;
                            tmpdices.push(dice);
                        }
                    }
                    dices.push(...newdices);
                    return { isDestroy: false }
                }
                if (trigger == 'phase-start' && site.cnt >= 3) {
                    return { cmds: [{ cmd: 'getCard', cnt: 2 }, { cmd: 'getDice', cnt: 2, element: 0 }], isDestroy: true }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 望舒客栈
    4006: (cardId: number) => new GISite(4006, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { heros = [] } = options;
        return {
            trigger: ['phase-end'],
            exec: () => {
                const minHp = Math.min(...heros.filter(h => h.hp > 0 && h.hp < h.maxhp && !h.isFront).map(h => h.hp));
                const hidxs: number[] = [];
                const fhidx = heros.findIndex(h => h.isFront);
                for (let i = 1; i < heros.length; ++i) {
                    const hidx = (i + fhidx) % heros.length;
                    if (heros[hidx].hp == minHp) {
                        hidxs.push(hidx);
                        break;
                    }
                }
                if (hidxs.length == 0) return { isDestroy: false }
                --site.cnt;
                return { cmds: [{ cmd: 'heal', hidxs, cnt: 2 }], isDestroy: site.cnt == 0 }
            }
        }
    }, 2),
    // 西风大教堂
    4007: (cardId: number) => new GISite(4007, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { heros = [] } = options;
        return {
            trigger: ['phase-end'],
            exec: () => {
                const frontHeroIdx = heros.findIndex(h => h.isFront);
                if (frontHeroIdx == -1 || heros[frontHeroIdx].hp == heros[frontHeroIdx].maxhp) {
                    return { isDestroy: false }
                }
                --site.cnt;
                return { cmds: [{ cmd: 'heal', hidxs: [frontHeroIdx], cnt: 2 }], isDestroy: site.cnt == 0 }
            }
        }
    }, 2),

    // 晨曦酒庄
    4008: (cardId: number) => new GISite(4008, cardId, 0, 1, 3, (site: GISite) => ({
        trigger: ['change'],
        isNotAddTask: true,
        minusDiceHero: site.perCnt,
        exec: (exeOpt: SiteExeOption) => {
            let { changeHeroDiceCnt = 0 } = exeOpt;
            if (site.perCnt > 0 && changeHeroDiceCnt > 0) {
                --site.perCnt;
                --changeHeroDiceCnt;
            }
            return { changeHeroDiceCnt, isDestroy: false }
        }
    })),
    // 骑士团图书馆
    4009: (cardId: number) => new GISite(4009, cardId, 0, 0, 3, () => ({
        trigger: ['phase-dice'],
        addRollCnt: 1,
    })),
    // 群玉阁
    4010: (cardId: number) => new GISite(4010, cardId, 0, 0, 3, (_site: GISite, options: SiteOption = {}) => {
        const { hcards = [], trigger = '' } = options;
        const triggers: Trigger[] = ['phase-dice'];
        if (hcards.length <= 3) triggers.push('phase-start');
        return {
            trigger: triggers,
            element: -2,
            cnt: 2,
            exec: () => {
                if (trigger == 'phase-start') {
                    return { cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: true }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 凯瑟琳
    4011: (cardId: number) => new GISite(4011, cardId, 0, 1, 3, (site: GISite) => ({
        trigger: ['change'],
        isNotAddTask: true,
        isQuickAction: site.perCnt == 1,
        exec: (exeOpt: SiteExeOption) => {
            if (site.perCnt > 0 && exeOpt?.isQuickAction) --site.perCnt;
            return { isDestroy: false }
        }
    })),
    // 蒂玛乌斯
    4012: (cardId: number) => new GISite(4012, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, trigger = '', minusDiceCard: mdc = 0 } = options;
        const isMinus = site.perCnt > 0 && card && card.subType.includes(1) && card.cost > mdc && site.cnt >= card.cost - mdc;
        return {
            trigger: ['phase-end', 'card'],
            isNotAddTask: trigger != 'phase-end',
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: () => {
                if (trigger == 'phase-end') ++site.cnt;
                else if (trigger == 'card' && isMinus) {
                    site.cnt -= card.cost - mdc;
                    --site.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 瓦格纳
    4013: (cardId: number) => new GISite(4013, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, trigger = '', minusDiceCard: mdc = 0 } = options;
        const isMinus = site.perCnt > 0 && card && card.subType.includes(0) && card.cost > mdc && site.cnt >= card.cost - mdc;
        return {
            trigger: ['phase-end', 'card'],
            isNotAddTask: trigger != 'phase-end',
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: () => {
                if (trigger == 'phase-end') ++site.cnt;
                else if (trigger == 'card' && isMinus) {
                    site.cnt -= card.cost - mdc;
                    --site.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 卯师傅
    4014: (cardId: number) => new GISite(4014, cardId, 1, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card } = options;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            exec: () => {
                if (site.perCnt <= 0 || !card?.subType?.includes(5)) return { isDestroy: false }
                --site.perCnt;
                const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, element: -1 }];
                if (site.cnt > 0) {
                    --site.cnt;
                    cmds.push({ cmd: 'getCard', cnt: 1, subtype: 5 });
                }
                return { cmds, isDestroy: false }
            }
        }
    }),
    // 阿圆
    4015: (cardId: number) => new GISite(4015, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card, minusDiceCard: mdc = 0 } = options;
        const isMinus = site.perCnt > 0 && card && card.subType.includes(2) && card.cost > mdc;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? 2 : 0,
            exec: () => {
                if (isMinus) --site.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 提米
    4016: (cardId: number) => new GISite(4016, cardId, 1, 0, 2, (site: GISite) => ({
        trigger: ['phase-start'],
        exec: () => {
            if (++site.cnt < 3) return { isDestroy: false }
            return {
                cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: 0 }],
                isDestroy: true,
            }
        }
    })),
    // 艾琳
    4017: (cardId: number) => new GISite(4017, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(options, { skill: [0, 0, 1] },
            skill => (skill?.useCnt ?? 0) > 0 && site.perCnt > 0);
        return {
            trigger: ['skill'],
            isNotAddTask: true,
            ...minusSkillRes,
            exec: () => {
                if (site.perCnt > 0 && isMinusSkill) {
                    --site.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 田铁嘴
    4018: (cardId: number) => new GISite(4018, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { heros = [] } = options;
        const hidxs: number[] = [];
        const frontHeroIdx = heros.findIndex(h => h.isFront);
        if (frontHeroIdx > -1 && heros[frontHeroIdx].energy < heros[frontHeroIdx].maxEnergy) {
            hidxs.push(frontHeroIdx);
        } else {
            const hidx = heros.findIndex(h => h.energy < h.maxEnergy);
            if (hidx > -1) hidxs.push(hidx);
        }
        return {
            trigger: ['phase-end'],
            exec: () => {
                if (hidxs.length == 0) return { isDestroy: false }
                --site.cnt;
                return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 刘苏
    4019: (cardId: number) => new GISite(4019, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { heros = [], hidx = -1 } = options;
        if (hidx == -1) return {}
        return {
            trigger: ['change'],
            exec: () => {
                if (site.perCnt == 0 || (heros[hidx]?.energy ?? 1) > 0) return { isDestroy: false }
                --site.perCnt;
                --site.cnt;
                return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hidx] }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 便携营养袋
    4020: (cardId: number) => new GISite(4020, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card } = options;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            exec: () => {
                if (site.perCnt <= 0 || !card?.subType?.includes(5)) return { isDestroy: false }
                --site.perCnt;
                return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: 5 }], isDestroy: false }
            }
        }
    }),
    // 天守阁
    4021: (cardId: number) => new GISite(4021, cardId, 0, 0, 3,
        (_site: GISite, options: SiteOption = {}) => {
            const { dices = [] } = options;
            return {
                trigger: ['phase-start'],
                exec: () => {
                    const cmds: Cmds[] = [];
                    if (new Set(dices.filter(v => v > 0)).size + dices.filter(v => v == 0).length >= 5) {
                        cmds.push({ cmd: 'getDice', cnt: 1, element: 0 });
                    }
                    return { cmds, isDestroy: false }
                }
            }
        }),
    // 鸣神大社
    4022: (cardId: number) => new GISite(4022, cardId, 2, 0, 1, (site: GISite) => ({
        trigger: ['phase-start'],
        exec: () => {
            --site.cnt;
            return { cmds: [{ cmd: 'getDice', cnt: 1, element: -1 }], isDestroy: site.cnt == 0 }
        }
    })),
    // 珊瑚宫
    4023: (cardId: number) => new GISite(4023, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => ({
        trigger: ['phase-end'],
        exec: () => {
            const { heros = [] } = options;
            if (heros.every(h => h.hp == h.maxhp)) return { isDestroy: false }
            --site.cnt;
            return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(options.heros) }], isDestroy: site.cnt == 0 }
        }
    })),
    // 须弥城
    4024: (cardId: number) => new GISite(4024, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { dices = [], hcards = [], card, trigger = '', minusDiceCard: mdc = 0 } = options;
        const isMinus = dices.length <= hcards.length && site.perCnt > 0;
        const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(options, { skilltype: [0, 0, 1] }, () => isMinus);
        const isCard = card && card.subType.includes(6) && card.cost > mdc;
        return {
            ...minusSkillRes,
            minusDiceCard: isMinus && isCard ? 1 : 0,
            trigger: ['skill', 'card'],
            isNotAddTask: true,
            exec: () => {
                if (isMinus && (trigger == 'skill' && isMinusSkill || trigger == 'card' && isCard)) {
                    --site.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 桓那兰那
    4025: (cardId: number) => new GISite(4025, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { dices = [], trigger } = options;
        return {
            trigger: ['phase-end', 'phase-start'],
            exec: () => {
                if (trigger == 'phase-end') {
                    const tmpdices: number[] = [];
                    const newdices: number[] = [];
                    while (dices.length > 0) {
                        const dice = dices.shift() ?? 0;
                        if (site.cnt < 2) {
                            tmpdices.push(dice);
                            ++site.cnt;
                        } else newdices.push(dice);
                    }
                    dices.push(...newdices);
                    site.perCnt = -Number(tmpdices.map(v => v == 0 ? 8 : v).join(''));
                    return { isDestroy: false }
                }
                if (trigger == 'phase-start') {
                    const element = site.perCnt.toString().slice(1).split('').map(v => Number(v) % 8);
                    site.cnt = 0;
                    site.perCnt = 0;
                    return { cmds: [{ cmd: 'getDice', cnt: 2, element }], isDestroy: false }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 镇守之森
    4026: (cardId: number) => new GISite(4026, cardId, 3, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { isFirst = true } = options;
        return {
            trigger: ['phase-start'],
            exec: () => {
                if (isFirst) return { isDestroy: false }
                --site.cnt;
                return {
                    cmds: [{ cmd: 'getDice', cnt: 1, element: -2 }],
                    isDestroy: site.cnt == 0,
                }
            }
        }
    }),
    // 黄金屋
    4027: (cardId: number) => new GISite(4027, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, minusDiceCard: mdc = 0 } = options;
        const isMinus = site.perCnt > 0 && card && card.cost >= 3 && card.subType.some(v => v < 2) && card.cost > mdc;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? 1 : 0,
            exec: () => {
                if (!isMinus) return { isDestroy: false }
                --site.cnt;
                --site.perCnt;
                return { isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 化城郭
    4028: (cardId: number) => new GISite(4028, cardId, 3, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { dices = [] } = options;
        return {
            trigger: ['action-start'],
            exec: () => {
                if (site.perCnt == 0 || dices.length > 0) return { isDestroy: false }
                --site.cnt;
                --site.perCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 花散里
    4029: (cardId: number) => new GISite(4029, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, trigger = '', minusDiceCard: mdc = 0 } = options;
        const isMinus = site.cnt >= 3 && card && card.subType.some(v => v < 2) && card.cost > mdc;
        return {
            trigger: ['summon-destroy', 'card'],
            minusDiceCard: isMinus ? 2 : 0,
            exec: (exeOpt: SiteExeOption) => {
                let { summonDiffCnt = 0 } = exeOpt;
                if (trigger == 'card' && isMinus) return { isDestroy: true }
                if (trigger == 'summon-destroy' && site.cnt < 3) {
                    site.cnt = Math.min(3, site.cnt + summonDiffCnt);
                }
                return { isDestroy: false }
            }
        }
    }),
    // 鲸井小弟
    4030: (cardId: number) => new GISite(4030, cardId, 0, 0, 3, () => ({
        trigger: ['phase-start'],
        isExchange: true,
        exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: true })
    })),
    // 旭东
    4031: (cardId: number) => new GISite(4031, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card, minusDiceCard: mdc = 0 } = options;
        const isMinus = card && card.subType.includes(5) && card.cost > mdc && site.perCnt > 0;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? 2 : 0,
            exec: () => {
                if (isMinus) --site.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 迪娜泽黛
    4032: (cardId: number) => new GISite(4032, cardId, -1, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card, minusDiceCard: mdc = 0 } = options;
        const isMinus = card && card.subType.includes(3) && card.cost > mdc && site.perCnt > 0;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? 1 : 0,
            exec: () => {
                let cmds: Cmds[] | undefined;
                if (isMinus) --site.perCnt;
                if (site.cnt < 0) {
                    ++site.cnt;
                    cmds = [{ cmd: 'getCard', cnt: 1, subtype: 3 }];
                }
                return { cmds, isDestroy: false }
            }
        }
    }),
    // 拉娜
    4033: (cardId: number) => new GISite(4033, cardId, 0, 1, 3, (site: GISite) => ({
        trigger: ['skilltype2'],
        exec: () => {
            if (site.perCnt == 0) return { isDestroy: false }
            --site.perCnt;
            return {
                cmds: [{ cmd: 'getDice', cnt: 1, element: -3 }],
                isDestroy: false,
            }
        }
    })),
    // 老章
    4034: (cardId: number) => new GISite(4034, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card, heros = [], minusDiceCard: mdc = 0 } = options;
        const isMinus = card && card.subType.includes(0) && card.cost > mdc && site.perCnt > 0;
        const minusCnt = 1 + heros.filter(h => h.weaponSlot != null).length;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? minusCnt : 0,
            exec: () => {
                if (isMinus) --site.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 塞塔蕾
    4035: (cardId: number) => new GISite(4035, cardId, 3, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { hcards } = options;
        return {
            trigger: ['action-start'],
            exec: () => {
                if ((hcards?.length ?? 1) > 0) return { isDestroy: false }
                --site.cnt;
                return { cmds: [{ cmd: 'getCard', cnt: 1 }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 弥生七月
    4036: (cardId: number) => new GISite(4036, cardId, 0, 1, 3, (site: GISite, options: SiteOption = {}) => {
        const { card, heros = [], minusDiceCard: mdc = 0 } = options;
        const isMinus = card && card.subType.includes(1) && card.cost > mdc && site.perCnt > 0;
        const minusCnt = 1 + heros.filter(h => h.artifactSlot != null).length;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isMinus ? minusCnt : 0,
            exec: () => {
                if (isMinus) --site.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 红羽团扇
    4037: (cardId: number) => new GISite(4037, cardId, 0, 1, 3, (site: GISite) => ({
        trigger: ['change'],
        isNotAddTask: true,
        exec: () => {
            if (site.perCnt == 0) return { isDestroy: false }
            --site.perCnt;
            return { outStatus: [heroStatus(2084)], isDestroy: false }
        }
    })),
    // 寻宝仙灵
    4038: (cardId: number) => new GISite(4038, cardId, 0, 0, 2, (site: GISite) => ({
        trigger: ['skill'],
        siteCnt: site.cnt < 2 ? 1 : -3,
        exec: () => {
            if (++site.cnt < 3) return { isDestroy: false }
            return { cmds: [{ cmd: 'getCard', cnt: 3 }], isDestroy: true }
        }
    })),
    // 风龙废墟
    4039: (cardId: number) => new GISite(4039, cardId, 3, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, trigger = '', minusDiceCard: mdc = 0 } = options;
        const isCardMinus = card && card.subType.includes(6) && card.cost > mdc && site.perCnt > 0;
        const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(options, { skill: [0, 0, 1] },
            skill => site.perCnt > 0 && skill.cost.toString().padStart(2, '0').split('').reduce((a, c) => a + Number(c), 0) >= 4)
        return {
            trigger: ['skill', 'card'],
            isNotAddTask: true,
            minusDiceCard: isCardMinus ? 1 : 0,
            ...minusSkillRes,
            exec: () => {
                if (site.perCnt > 0 && (trigger == 'card' && isCardMinus ||
                    trigger.startsWith('skill') && isMinusSkill)) {
                    --site.perCnt;
                    --site.cnt;
                }
                return { isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 湖中垂柳
    4040: (cardId: number) => new GISite(4040, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { hcards = [] } = options;
        return {
            trigger: hcards.length <= 2 ? ['phase-end'] : [],
            exec: () => {
                --site.cnt;
                return { cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 欧庇克莱歌剧院
    4041: (cardId: number) => new GISite(4041, cardId, 3, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { heros = [], eheros = [] } = options;
        const slotCost = heros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot])
            .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
        const eslotCost = eheros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot])
            .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
        return {
            trigger: slotCost >= eslotCost && site.perCnt > 0 ? ['action-start'] : [],
            exec: () => {
                --site.cnt;
                --site.perCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: -2 }], isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 玛梅赫
    4042: (cardId: number) => new GISite(4042, cardId, 3, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card } = options;
        const isUse = card?.id != 321 && site.perCnt > 0 && card?.subType.some(st => [2, 3, 4, 5].includes(st));
        return {
            trigger: isUse ? ['card'] : [],
            exec: () => {
                --site.cnt;
                --site.perCnt;
                let card: Card | undefined;
                while (!card) {
                    let rid = Math.ceil(Math.random() * 400 + 200);
                    if (rid == 321) continue;
                    if (rid > 500) rid += 100;
                    card = cardsTotal(rid);
                }
                return {
                    cmds: [{ cmd: 'getCard', cnt: 1, card }],
                    isDestroy: site.cnt == 0
                }
            }
        }
    }),
    // 化种匣
    4043: (cardId: number) => new GISite(4043, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, minusDiceCard: mdc = 0 } = options;
        const isMinus = card && card.cost == 1 && card.type < 2 && site.perCnt > 0 && card.cost > mdc;
        return {
            trigger: ['card'],
            minusDiceCard: isMinus ? 1 : 0,
            isNotAddTask: true,
            exec: () => {
                if (isMinus) {
                    --site.cnt;
                    --site.perCnt;
                }
                return { isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 留念镜
    4044: (cardId: number) => new GISite(4044, cardId, 2, 1, 2, (site: GISite, options: SiteOption = {}) => {
        const { card, playerInfo: { usedCardIds = [] } = {}, minusDiceCard: mdc = 0 } = options;
        const isMinus = card && usedCardIds.includes(card.id) && card.subType.some(sbtp => sbtp < 4) && site.perCnt > 0 && card.cost > mdc;
        return {
            trigger: ['card'],
            minusDiceCard: isMinus ? 2 : 0,
            isNotAddTask: true,
            exec: () => {
                if (isMinus) {
                    --site.cnt;
                    --site.perCnt;
                }
                return { isDestroy: site.cnt == 0 }
            }
        }
    }),
    // 婕德
    4045: (cardId: number, cnt: number) => new GISite(4045, cardId, cnt, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { trigger = '', playerInfo: { destroyedSite = 0 } = {} } = options;
        return {
            trigger: ['site-destroy', 'skilltype3'],
            exec: () => {
                if (trigger == 'skilltype3' && site.cnt >= 5) {
                    return { cmds: [{ cmd: 'getDice', element: 0, cnt: site.cnt - 2 }], isDestroy: true }
                }
                if (trigger == 'site-destroy') {
                    site.cnt = Math.min(6, destroyedSite);
                }
                return { isDestroy: false }
            }
        }
    }),
    // 西尔弗和迈勒斯
    4046: (cardId: number, cnt: number) => new GISite(4046, cardId, cnt, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { trigger = '', playerInfo: { oppoGetElDmgType = 0 } = {} } = options;
        const triggers: Trigger[] = [1, 2, 3, 4, 5, 6, 7].map(v => ELEMENT_ICON[v] + '-getdmg-oppo') as Trigger[];
        if (site.cnt >= 3) triggers.push('phase-end');
        return {
            trigger: triggers,
            isNotAddTask: trigger != 'phase-end',
            exec: () => {
                if (trigger == 'phase-end' && site.cnt >= 3) {
                    return { cmds: [{ cmd: 'getCard', cnt: site.cnt }], isDestroy: true }
                }
                if (trigger.endsWith('-getdmg-oppo')) {
                    let typelist = oppoGetElDmgType;
                    let elcnt = 0;
                    while (typelist != 0) {
                        typelist &= typelist - 1;
                        ++elcnt;
                    }
                    site.cnt = Math.min(4, elcnt);
                }
                return { isDestroy: false }
            }
        }
    }),
    // 梅洛彼得堡
    4047: (cardId: number) => new GISite(4047, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { hidxs = [], getdmg = [], heal = [], trigger = '' } = options;
        const triggers: Trigger[] = [];
        if (trigger == 'getdmg' && getdmg[hidxs[0]] > 0 && site.cnt < 4) triggers.push('getdmg');
        if (trigger == 'heal' && heal[hidxs[0]] > 0 && site.cnt < 4) triggers.push('heal');
        if (site.cnt >= 4) triggers.push('phase-start');
        const isAdd = triggers.some(tr => ['getdmg', 'heal'].includes(tr));
        return {
            trigger: triggers,
            siteCnt: isCdt(isAdd, 1),
            exec: () => {
                if (trigger == 'phase-start' && site.cnt >= 4) {
                    site.cnt -= 4;
                    return { cmds: [{ cmd: 'getOutStatusOppo', status: [heroStatus(2174)] }], isDestroy: false }
                }
                site.cnt = Math.min(4, site.cnt + 1);
                return { isDestroy: false }
            }
        }
    }),
    // 流明石触媒
    4048: (cardId: number) => new GISite(4048, cardId, 3, 3, 2, (site: GISite) => {
        const triggers: Trigger[] = [];
        if (site.perCnt > 0) triggers.push('card');
        return {
            trigger: triggers,
            exec: () => {
                --site.perCnt;
                if (site.perCnt == 0) --site.cnt;
                return {
                    cmds: isCdt(site.perCnt == 0, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: 0 }]),
                    isDestroy: site.cnt == 0,
                }
            }
        }
    }),
    // 清籁岛
    4049: (cardId: number) => new GISite(4049, cardId, 2, 0, 1, (site: GISite, options: SiteOption = {}) => {
        const { heal = [], trigger = '' } = options;
        const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl > 0).map(v => v.hli);
        return {
            trigger: ['heal', 'eheal', 'phase-end'],
            exec: () => {
                if (trigger == 'phase-end') return { isDestroy: --site.cnt == 0 }
                return {
                    cmds: [{ cmd: `getInStatus${trigger == 'eheal' ? 'Oppo' : ''}`, status: [heroStatus(2184)], hidxs }],
                    isDestroy: false,
                }
            }
        }
    }),
    // 太郎丸
    4050: (cardId: number) => new GISite(4050, cardId, 0, 0, 2, (site: GISite, options: SiteOption = {}) => {
        const { card } = options;
        if (card?.id != 902) return {}
        return {
            trigger: ['card'],
            siteCnt: site.cnt < 1 ? 1 : -2,
            summon: isCdt(site.cnt == 1, [newSummonee(3059)]),
            exec: () => {
                ++site.cnt;
                return { isDestroy: site.cnt >= 2 }
            },
        }
    }),
    // 白手套和渔夫
    4051: (cardId: number) => new GISite(4051, cardId, 2, 0, 1, (site: GISite) => ({
        trigger: ['phase-end'],
        exec: () => {
            --site.cnt;
            return {
                cmds: [{ cmd: 'addCard', cnt: 1, card: 903 + site.cnt, hidxs: [5] }],
                isDestroy: site.cnt == 0,
            }
        }
    })),
}

export const newSite = (id: number, ...args: any) => siteTotal[id](...args);