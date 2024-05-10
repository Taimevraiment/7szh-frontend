import { newSite } from './site';
import { heroStatus } from './heroStatus';
import { ELEMENT, HERO_LOCAL, WEAPON_TYPE } from './constant';
import { newSummonee } from './summonee';
import { herosTotal } from './heros';
import { allHidxs, isCdt, minusDiceSkillHandle } from './utils';

class GICard implements Card {
    id: number;
    name: string;
    description: string;
    src: string;
    cost: number;
    costType: number;
    type: number;
    subType: number[];
    userType: number;
    useCnt: number;
    perCnt: number;
    canSelectHero: number;
    canSelectSummon: number;
    canSelectSite: number;
    cnt: number = 2;
    energy: number = 0;
    anydice: number = 0;
    handle: (card: Card, event: CardHandleEvent) => CardHandleRes;
    costChange: number = 0;
    selected: boolean = false;
    pos: number = 0;
    descriptions: string[] = [];
    explains: ExplainContent[];
    constructor(
        id: number, name: string, description?: string, src?: string, cost?: number, costType?: number, type?: number, subType?: number[],
        userType: number = 0, canSelectHero?: number, handle?: (card: Card, event: CardHandleEvent) => CardHandleRes | void,
        options: {
            uct?: number, pct?: number, expl?: ExplainContent[], energy?: number, anydice?: number, canSelectSummon?: number,
            isResetUct?: boolean, isResetPct?: boolean, spReset?: boolean, canSelectSite?: number
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.description = description ?? '';
        if (subType?.includes(-2)) this.description += `；(每回合中，最多通过｢料理｣复苏1个角色，并且每个角色最多食用1次｢料理｣)`;
        else if (subType?.includes(-3)) this.description += `；(牌组包含至少2个｢${HERO_LOCAL[id - 570]}｣角色，才能加入牌组)`;
        else if (subType?.includes(0)) this.description += `；(｢${WEAPON_TYPE[userType]}｣【角色】才能装备。角色最多装备1件｢武器｣)`;
        else if (subType?.includes(1)) this.description += `；(角色最多装备1件｢圣遗物｣)`;
        else if (subType?.includes(5)) this.description += `；(每回合每个角色最多食用1次｢料理｣)`;
        else if (subType?.includes(8)) this.description += `；(整局游戏只能打出一张｢秘传｣卡牌; 这张牌一定在你的起始手牌中)`;
        else if (subType?.includes(9)) {
            const el = Math.ceil((id - 580) / 2);
            this.description += `；(牌组中包含至少2个‹${el}${ELEMENT[el]}›角色，才能加入牌组)`;
        } else if (subType?.includes(6)) this.description += `；(牌组中包含【${herosTotal(userType).name}】，才能加入牌组)`;
        this.src = src?.startsWith('https://') || src == '' ? src : 'http://taim.3vhost.club/geniusInovakation/' + src;
        this.cost = cost ?? 0;
        this.costType = costType ?? 8;
        this.type = type ?? -1;
        this.subType = subType ?? [];
        this.userType = userType;
        this.canSelectHero = canSelectHero ?? 0;
        if (subType?.includes(8)) this.cnt = 1;
        const { uct = -1, pct = 0, expl = [], energy = 0, anydice = 0, canSelectSummon = -1,
            isResetPct = true, isResetUct = false, spReset = false, canSelectSite = -1 } = options;
        this.handle = (card, event) => {
            const { reset = false } = event;
            if (reset) {
                if (isResetPct) card.perCnt = pct;
                if (isResetUct) card.useCnt = uct;
                if (!spReset) return {}
            }
            const handleRes = handle?.(card, event) ?? {};
            return handleRes;
        }
        this.useCnt = uct;
        this.perCnt = pct;
        this.explains = expl;
        this.energy = energy;
        this.anydice = anydice;
        this.canSelectSummon = canSelectSummon;
        this.canSelectSite = canSelectSite;
    }
}

const normalWeapon = (id: number, name: string, userType: number, src: string) => {
    return new GICard(id, name, '【角色造成的伤害+1】。', src, 2, 8, 0, [0], userType, 1, () => ({ addDmg: 1 }));
}

const jiliWeapon = (id: number, name: string, userType: number, src: string) => {
    return new GICard(id, name, '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】生成1个此角色类型的元素骰(每回合1次)。', src, 3, 8, 0, [0], userType, 1,
        (card, event) => {
            const { heros = [], hidxs = [] } = event;
            return {
                addDmg: 1,
                trigger: ['skilltype2'],
                execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: heros[hidxs[0]].element ?? 0 }]),
                exec: () => {
                    if (card.perCnt > 0) --card.perCnt;
                }
            }
        }, { pct: 1 });
}

const tiankongWeapon = (id: number, name: string, userType: number, src: string) => {
    return new GICard(id, name, '【角色造成的伤害+1】。；【每回合1次：】角色使用｢普通攻击｣造成的伤害额外+1。', src, 3, 8, 0, [0], userType, 1,
        card => ({
            addDmg: 1,
            addDmgCdt: card.perCnt,
            trigger: ['skilltype1'],
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 1 });
}

const senlin1Weapon = (id: number, name: string, userType: number, src: string) => {
    return new GICard(id, name, '【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时少花费2个元素骰。', src, 3, 8, 0, [0], userType, 1,
        () => ({ addDmg: 1, inStatus: [heroStatus(2061, name)] }));
}

const senlin2Weapon = (id: number, name: string, userType: number, src: string) => {
    return new GICard(id, name, '【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次使用｢普通攻击｣后：生成2个此角色类型的元素骰。', src, 3, 0, 0, [0], userType, 1,
        () => ({ addDmg: 1, inStatus: [heroStatus(2060, name)] }));
}

const normalElArtifact = (id: number, name: string, element: number, src: string) => {
    return new GICard(id, name, `【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT[element]}骰]。(每回合1次)`, src, 2, 0, 0, [1], 0, 1,
        (card, event) => {
            const { heros = [], hidxs = [], hcard, trigger = '', minusDiceCard: mdc = 0 } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [1, 0, 0] },
                skill => skill?.cost[0].color == element && card.perCnt > 0);
            const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && card.perCnt > 0 && hcard.cost > mdc;
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isCardMinus, 1),
                trigger: ['skill', 'card'],
                exec: () => {
                    if (trigger == 'card' && !isCardMinus || trigger == 'skill' && !isMinusSkill || card.perCnt <= 0) return;
                    --card.perCnt;
                }
            }
        }, { pct: 1 });
}

const advancedElArtifact = (id: number, name: string, element: number, src: string) => {
    return new GICard(id, name, `【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT[element]}骰]。(每回合1次)；【投掷阶段：】2个元素骰初始总是投出[${ELEMENT[element]}骰]。`, src, 2, 8, 0, [1], 0, 1,
        (card, event) => {
            const { heros = [], hidxs = [], hcard, trigger = '', minusDiceCard: mdc = 0 } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [1, 0, 0] },
                skill => skill?.cost[0].color == element && card.perCnt > 0);
            const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && card.perCnt > 0 && hcard.cost > mdc;
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isCardMinus, 1),
                trigger: ['skill', 'card', 'phase-dice'],
                element,
                cnt: 2,
                exec: () => {
                    if (trigger == 'card' && !isCardMinus || trigger == 'skill' && !isMinusSkill || card.perCnt <= 0) return;
                    --card.perCnt;
                }
            }
        }, { pct: 1 });
}

const elCard = (id: number, element: number, src: string) => {
    return new GICard(id, '元素共鸣：交织之' + ELEMENT[element][0], `生成1个[${ELEMENT[element]}骰]。`,
        src, 0, 8, 2, [9], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element }] }));
}

const magicCount = (cnt: number, id?: number) => new GICard(id ?? (909 + 2 - cnt), `幻戏${cnt > 0 ? `倒计时：${cnt}` : '开始！'}`, `将我方所有元素骰转换为[万能元素骰]，摸4张牌。${cnt > 0 ? '；此牌在手牌或牌库中被[舍弃]后：将1张元素骰费用比此卡少1个的｢幻戏倒计时｣放置到你的牌库顶。' : ''}`,
    `https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Event_Event_MagicCount${cnt}.png`,
    cnt, 8, 2, [], 0, 0, (_card, event) => {
        const { trigger = '' } = event;
        const cmds: Cmds[] = trigger == 'discard' ?
            [{ cmd: 'addCard', cnt: 1, card: 909 + 3 - cnt, hidxs: [1] }] :
            [{ cmd: 'changeDice', element: 0 }, { cmd: 'getCard', cnt: 4 }];
        return { trigger: isCdt(cnt > 0, ['discard']), cmds }
    });

const talentSkill = (skidx: number): () => ({ trigger: Trigger[], cmds: Cmds[] }) => {
    return () => ({ trigger: ['skill'], cmds: [{ cmd: 'useSkill', cnt: skidx }] });
}

const talentHandle = (event: CardHandleEvent, skidx: number, nexec: () => [(() => CardExecRes | void)?, CardHandleRes?] | undefined, ntrigger: Trigger | Trigger[] = 'skill') => {
    const { reset = false, trigger = '' } = event;
    const { trigger: talTrg, cmds: talCmds } = talentSkill(skidx)();
    const cmds: Cmds[] = [...talCmds];
    if (typeof ntrigger == 'string') {
        if (ntrigger != '') ntrigger = [ntrigger];
        else ntrigger = [];
    }
    const isTrigger = ntrigger.length == 0 || [...ntrigger, 'calc'].some(tr => tr == trigger.split(':')[0]);
    if (isTrigger && ntrigger.length > 0) cmds.length = 0;
    const [nexecf = () => ({}), hdres = {}] = nexec() ?? [];
    if (reset) return hdres;
    const exec = () => isTrigger ? (nexecf() ?? {}) : ({});
    const triggers: Trigger[] = ntrigger.some(tr => talTrg.includes(tr)) ? talTrg : ntrigger;
    return {
        ...(isTrigger ? hdres : {}),
        trigger: [...new Set([...triggers, ...(isTrigger ? (hdres.trigger ?? []) : [])])],
        cmds,
        exec,
    }
}

const talentExplain = (hid: number, skidx: number) => [herosTotal(hid).skills[skidx], ...herosTotal(hid).skills[skidx].explains];

type CardObj = {
    [id: string]: GICard
}

// id 0xx：武器
// id 1xx：圣遗物
// id 2xx：场地
// id 3xx：伙伴
// id 4xx：道具
// id 5xx：事件
// id 6xx：料理
// id 7xx：天赋

const extraCards: CardObj = {
    901: new GICard(901, '雷楔', '[战斗行动]：将【刻晴】切换到场上，立刻使用【星斗归位】。本次【星斗归位】会为【刻晴】附属【雷元素附魔】，但是不会再生成【雷楔】。(【刻晴】使用【星斗归位】时，如果此牌在手中：不会再生成【雷楔】，而是改为[舍弃]此牌，并为【刻晴】附属【雷元素附魔】)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/12109492/3d370650e825a27046596aaf4a53bb8d_7172676693296305743.png',
        3, 3, 2, [7], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidx = heros.findIndex(h => h.id == 1303);
            const fhidx = heros.findIndex(h => h.isFront);
            const cmds: Cmds[] = [{ cmd: 'useSkill', cnt: 1 }];
            if (hidx != fhidx) cmds.unshift({ cmd: 'switch-to', hidxs: [hidx] });
            return { trigger: ['skilltype2'], cmds }
        }, { expl: talentExplain(1303, 2) }),

    902: new GICard(902, '太郎丸的存款', '生成1个[万能元素骰]。',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_Taroumaru.png',
        0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }] })),

    903: new GICard(903, '｢清洁工作｣', '我方出战角色下次造成伤害+1。(可叠加，最多叠加到+2)',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_Baishoutao.png',
        0, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2185)] })),

    904: new GICard(904, '海底宝藏', '治疗我方出战角色1点，生成1个随机基础元素骰。',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_Xunbao.png',
        0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'heal', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: -1 }] })),

    905: new GICard(905, '圣俗杂座', '在｢始基力：荒性｣和｢始基力：芒性｣之中，切换【芙宁娜】的形态。；如果我方场上存在【沙龙成员】或【众水的歌者】，也切换其形态。',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Event_Event_FurinaOusiaChange.png',
        0, 8, 2, [], 0, 0, (_card, event) => {
            const { heros = [], summons = [], isExec = false } = event;
            if (!isExec) return;
            const hero = heros.find(h => h.id == 1111);
            if (!hero) return;
            const nlocal = ((hero.local.pop() ?? 11) - 11) ^ 1;
            hero.local.push(11 + nlocal);
            hero.src = hero.srcs[nlocal];
            const smnIdx = summons.findIndex(smn => smn.id == 3060 + (nlocal ^ 1));
            if (smnIdx > -1) {
                const useCnt = summons[smnIdx].useCnt;
                summons.splice(smnIdx, 1, newSummonee(3060 + nlocal, useCnt));
            }
        }),

    906: new GICard(906, '噬骸能量块', '随机[舍弃]1张原本元素骰费用最高的手牌，生成1个我方出战角色类型的元素骰。如果我方出战角色是｢圣骸兽｣角色，则使其获得1点[充能]。(每回合最多打出1张)',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_ScorpionSacred.png',
        0, 8, 2, [], 0, 0, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const cmds: Cmds[] = [{ cmd: 'discard', element: 0 }, { cmd: 'getDice', cnt: 1, element: -2 }];
            const fhero = heros[hidxs[0]];
            if (fhero?.local.includes(13)) cmds.push({ cmd: 'getEnergy', cnt: 1 })
            return { isValid: !fhero?.outStatus.some(ost => ost.id == 2207), cmds, outStatus: [heroStatus(2207)] }
        }),

    907: new GICard(907, '唤醒眷属', '【打出此牌或[舍弃]此牌时：】召唤一个独立的【增殖生命体】。',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_Apep.png',
        2, 7, 2, [], 0, 0, () => ({ trigger: ['discard'], summon: [newSummonee(3063)] }), { expl: [newSummonee(3063)] }),

    908: new GICard(908, '禁忌知识', '无法使用此牌进行元素调和，且每回合最多只能打出1张｢禁忌知识｣。；对我方出战角色造成1点[穿透伤害]，摸1张牌。',
        'https://homdgcat.wiki/images/GCG/UI_Gcg_CardFace_Summon_ChiWangLin.png',
        0, 8, 2, [-5], 0, 0, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            return {
                isValid: !heros[hidxs[0]]?.outStatus.some(ost => ost.id == 2215),
                cmds: [{ cmd: 'attack', cnt: 1, element: -1, isOppo: true }, { cmd: 'getCard', cnt: 1 }],
                outStatus: [heroStatus(2215)],
            }
        }),

    909: magicCount(2),

    910: magicCount(1),

    911: magicCount(0),
}

const allCards: CardObj = {
    0: new GICard(0, '无'),

    1: normalWeapon(1, '魔导绪论', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/1abc432f853c6fa24624a92646c62237_7336928583967273301.png'),

    2: jiliWeapon(2, '祭礼残章', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a99ec73d99ed979a915e9a10a33a1e_5761287146349681281.png'),

    3: tiankongWeapon(3, '天空之卷', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/347336161ab1d81f0b5bf1508a392f64_4021839086739887808.png'),

    4: new GICard(4, '千夜浮梦', '【角色造成的伤害+1】。；【我方角色引发元素反应时：】造成的伤害+1。(每回合最多触发2次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a56d5cf80b505c42a3643534d3dc2821_8758750260465224130.png',
        3, 8, 0, [0], 4, 1, card => ({
            addDmg: 1,
            addDmgCdt: isCdt(card.perCnt > 0, 1),
            trigger: ['elReaction'],
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 2 }),

    5: new GICard(5, '盈满之实', '【角色造成的伤害+1】。；【入场时：】摸2张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/f396d3f86aecfc992feb76ed44485171_1252924063800768441.png',
        3, 0, 0, [0], 4, 1, () => ({ addDmg: 1, cmds: [{ cmd: 'getCard', cnt: 2 }] })),

    6: new GICard(6, '四风原典', '【此牌每有1点｢伤害加成｣，角色造成的伤害+1】。；【结束阶段：】此牌累积1点｢伤害加成｣。(最多累积到2点)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/c2774faa0cd618dddb0b7a641eede205_6906642161037931045.png',
        3, 8, 0, [0], 4, 1, card => ({
            addDmg: card.useCnt,
            trigger: ['phase-end'],
            exec: () => {
                if (card.useCnt < 2) ++card.useCnt;
            }
        }), { uct: 0 }),

    7: new GICard(7, '图莱杜拉的回忆', '【角色造成的伤害+1】。；【角色进行[重击]时：】少花费1个[无色元素骰]。(每回合最多触发2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/8f3cd8f38e2c411713f9b5e6dc826653_5506358063099958204.png',
        3, 8, 0, [0], 4, 1, (card, event) => {
            const { isChargedAtk = false } = event;
            const isMinus = isChargedAtk && card.perCnt > 0;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] }, () => isMinus);
            return {
                trigger: ['skilltype1'],
                addDmg: 1,
                ...minusSkillRes,
                exec: () => {
                    if (isMinus && isMinusSkill) --card.perCnt;
                }
            }
        }, { pct: 2 }),

    8: new GICard(8, '万世流涌大典', '【角色造成的伤害+1】。；【角色受到伤害或治疗后：】如果本回合已受到伤害或治疗累积2次，则角色本回合中下次造成的伤害+2。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/9a6794d76b3ea150a101e354f9f5a162_9095966637954555968.png',
        3, 8, 0, [0], 4, 1, (card, event) => {
            const { heal = [], hidxs = [], trigger = '' } = event;
            const isMinus = (trigger == 'getdmg' || trigger == 'heal' && heal[hidxs[0]] > 0) && card.perCnt > 0;
            return {
                trigger: ['getdmg', 'heal'],
                addDmg: 1,
                // execmds: isCdt<Cmds[]>(isMinus && card.useCnt == 1, [{ cmd: 'getStatus', status: [heroStatus(2172)] }]),
                exec: () => {
                    if (!isMinus) return;
                    if (card.useCnt < 2) ++card.useCnt;
                    if (card.useCnt >= 2) {
                        --card.perCnt;
                        return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2172)] }] }
                    }
                }
            }
        }, { pct: 1, uct: 0, isResetUct: true }),

    9: new GICard(9, '金流监督', '【角色受到伤害或治疗后：】使角色本回合中下一次｢普通攻击｣少花费1个[无色元素骰]，且造成的伤害+1。(每回合至多2次)',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_Jinliujiandu.webp',
        2, 8, 0, [0], 4, 1, (card, event) => {
            const { heal = [], hidxs = [], trigger = '' } = event;
            const isMinus = (trigger == 'getdmg' || trigger == 'heal' && heal[hidxs[0]] > 0) && card.perCnt > 0;
            return {
                trigger: ['getdmg', 'heal'],
                execmds: isCdt<Cmds[]>(isMinus, [{ cmd: 'getStatus', status: [heroStatus(2213)] }]),
                exec: () => {
                    if (isMinus) --card.perCnt;
                }
            }
        }, { pct: 2 }),

    21: normalWeapon(21, '鸦羽弓', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/e20881692f9c3dcb128e3768347af4c0_5029781426547880539.png'),

    22: jiliWeapon(22, '祭礼弓', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/4adb0666f4e171943739e4baa0863b48_5457536750893996771.png'),

    23: tiankongWeapon(23, '天空之翼', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/b50f747817c941c6ea72a56b4501a99c_2147958904876284896.png'),

    24: new GICard(24, '阿莫斯之弓', '【角色造成的伤害+1】。；【角色使用原本元素骰费用+充能费用至少为5的技能时，】伤害额外+2。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d974aa6b36205d2c4ee83900f6383f40_5244142374562514025.png',
        3, 8, 0, [0], 3, 1, (card, event) => {
            const { heros = [], hidxs = [], isSkill = -1 } = event;
            const skidxs: number[] = [];
            if (card.perCnt > 0) {
                for (let i = 0; i < heros[hidxs[0]].skills.length; ++i) {
                    const cskill = heros[hidxs[0]].skills[i];
                    if (cskill.type == 4) continue;
                    if (cskill.cost.reduce((a, c) => a + c.val, 0) >= 5) {
                        skidxs.push(i);
                    }
                }
            }
            return {
                addDmg: 1,
                addDmgCdt: isCdt(skidxs.includes(isSkill), 2),
                trigger: ['skill'],
                exec: () => {
                    if (card.perCnt > 0 && skidxs.includes(isSkill)) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    25: new GICard(25, '终末嗟叹之诗', '【角色造成的伤害+1】。；【角色使用｢元素爆发｣后：】生成【千年的大乐章·别离之歌】。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fc5f899e61c9236a1319ea0f3c8b7a64_3821389462721294816.png',
        3, 8, 0, [0], 3, 1, () => ({
            addDmg: 1,
            trigger: ['skilltype3'],
            execmds: [{ cmd: 'getStatus', status: [heroStatus(2048)] }],
        }), { expl: [heroStatus(2048)] }),

    26: senlin1Weapon(26, '王下近侍', 3, 'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/c667e01fa50b448958eff1d077a7ce1b_1806864451648421284.png'),

    27: new GICard(27, '竭泽', '【我方打出名称不存在于初始牌组中的行动牌后：】此牌累积1点｢渔猎｣。(最多累积2点)；【角色使用技能时：】如果此牌已有｢渔猎｣，则消耗所有｢渔猎｣，使此技能伤害+1，并且每消耗1点｢渔猎｣就摸1张牌。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_Jieze.webp',
        2, 8, 0, [0], 3, 1, (card, event) => {
            const { playerInfo: { initCardIds = [] } = {}, hcard, trigger = '' } = event;
            const triggers: Trigger[] = [];
            if (card.useCnt > 0) triggers.push('skill');
            if (hcard && !initCardIds.includes(hcard.id) && card.useCnt < 2) triggers.push('card');
            return {
                trigger: triggers,
                addDmgCdt: isCdt(card.useCnt > 0, 1),
                execmds: isCdt<Cmds[]>(trigger == 'skill' && card.useCnt > 0, [{ cmd: 'getCard', cnt: card.useCnt }]),
                exec: () => {
                    if (trigger == 'card') ++card.useCnt;
                    else if (trigger == 'skill') card.useCnt = 0;
                }
            }
        }, { uct: 0 }),

    41: normalWeapon(41, '白铁大剑', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/d8916ae5aaa5296a25c1f54713e2fd85_802175621117502141.png'),

    42: jiliWeapon(42, '祭礼大剑', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a410a0aad34824fdcf8ae986893d30_2999739715093754473.png'),

    43: new GICard(43, '狼的末路', '【角色造成的伤害+1】。；攻击剩余生命值不多于6的目标时，伤害额外+2。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/3ec60d32f7ce9f816a6dd784b8800e93_4564486285810218753.png',
        3, 8, 0, [0], 2, 1, (_card, event) => {
            const { eheros = [], ehidx = -1 } = event;
            return { trigger: ['skill'], addDmg: 1, addDmgCdt: isCdt((eheros[ehidx]?.hp ?? 10) <= 6, 2) }
        }),

    44: tiankongWeapon(44, '天空之傲', 2, 'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7ce2f924ae1b0922ea14eef9fbd3f2bb_951683174491798888.png'),

    45: new GICard(45, '钟剑', '【角色造成的伤害+1】。；【角色使用技能后：】为我方出战角色提供1点[护盾]。(每回合1次，可叠加到2点)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e8bf7a38608cc3811f32f396ccea01d4_493091124030114777.png',
        3, 8, 0, [0], 2, 1, (card, event) => {
            const { heros = [], hidxs = [] } = event;
            const shieldCnt = heros[hidxs[0]].outStatus.find(ost => ost.id == 2049)?.useCnt ?? 0;
            const isTriggered = card.perCnt > 0 && shieldCnt < 2;
            return {
                addDmg: 1,
                trigger: ['skill'],
                execmds: isCdt<Cmds[]>(isTriggered, [{ cmd: 'getStatus', status: [heroStatus(2049)] }]),
                exec: () => {
                    if (isTriggered) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    46: new GICard(46, '苇海信标', '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】本回合内，角色下次造成的伤害额外+1。(每回合1次)；【角色受到伤害后：】本回合内，角色下次造成的伤害额外+1。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/4148c247b2685dfcb305cc9b6c5e8cff_6450004800527281410.png',
        3, 8, 0, [0], 2, 1, (card, event) => {
            const { trigger = '' } = event;
            const isTriggered1 = trigger == 'skilltype2' && (card.perCnt >> 0 & 1) == 1;
            const isTriggered2 = trigger == 'getdmg' && (card.perCnt >> 1 & 1) == 1;
            const execmds: Cmds[] | undefined = isTriggered1 ? [{ cmd: 'getStatus', status: [heroStatus(2149)] }] :
                isTriggered2 ? [{ cmd: 'getStatus', status: [heroStatus(2150)] }] : undefined;
            return {
                addDmg: 1,
                trigger: ['skilltype2', 'getdmg'],
                execmds,
                exec: () => {
                    if (isTriggered1) card.perCnt &= ~(1 << 0);
                    if (isTriggered2) card.perCnt &= ~(1 << 1);
                }
            }
        }, { pct: 3 }),

    47: senlin2Weapon(47, '森林王器', 2, 'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_Shenlinwangqi.webp'),

    61: normalWeapon(61, '白缨枪', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2618b55f8449904277794039473df17c_5042678227170067991.png'),

    62: new GICard(62, '千岩长枪', '【角色造成的伤害+1】。；【入场时：】队伍中每有一名｢璃月｣角色，此牌就为附属的角色提供1点[护盾]。(最多3点)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/7b6b74c3444f624f117f8e05344d27ec_6292708375904670698.png',
        3, 8, 0, [0], 5, 1, (_card, event) => {
            const { heros } = event;
            const liyueCnt = Math.min(3, heros?.filter(h => h.local.includes(2))?.length ?? 0);
            return { addDmg: 1, inStatus: [heroStatus(2026, liyueCnt)] }
        }),

    63: tiankongWeapon(63, '天空之脊', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/788811f1c1ce03f56a89ecde4cbe52a7_2992557107190163621.png'),

    64: new GICard(64, '贯虹之槊', '【角色造成的伤害+1】。；角色如果在[护盾]角色状态或[护盾]出战状态的保护下，则造成的伤害额外+1。；【角色使用｢元素战技｣后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充1点[护盾]。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0a1242b4eeb9c6b6e731466fb182cb60_6226689090161933551.png',
        3, 8, 0, [0], 5, 1, (card, event) => {
            const { heros = [], hidxs = [], trigger = '' } = event;
            const fhero = heros[hidxs[0]];
            const isShieldStatus = fhero?.inStatus.some(ist => ist.type.includes(7)) || fhero?.outStatus.some(ost => ost.type.includes(7));
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isShieldStatus && trigger == 'skill', 1),
                trigger: ['skill', 'after-skilltype2'],
                exec: () => {
                    if (card.perCnt == 0 || trigger != 'after-skilltype2') return;
                    const ost = fhero.outStatus.find(ost => ost.type.includes(7));
                    if (ost) {
                        ++ost.useCnt;
                        --card.perCnt;
                    }
                }
            }
        }, { pct: 1 }),

    65: new GICard(65, '薙草之稻光', '【角色造成的伤害+1】。；【每回合自动触发1次：】如果所附属角色没有[充能]，就使其获得1点[充能]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1ed5905877be45aca0e92093e3b5fdbe_7752495456460826672.png',
        3, 8, 0, [0], 5, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const execmds = isCdt<Cmds[]>(heros[hidxs[0]]?.energy > 0, [{ cmd: 'getEnergy', cnt: 1, hidxs }]);
            return { addDmg: 1, trigger: ['phase-start'], execmds }
        }),

    66: senlin1Weapon(66, '贯月矢', 5, 'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/9d44a608d1ba86c970a0fe897f22121c_7239489409641716764.png'),

    67: new GICard(67, '和璞鸢', '【角色造成的伤害+1】。；【角色使用技能后：】直到回合结束前，此牌所提供的伤害加成值额外+1。(最多累积到+2)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/972e1ba2e544111bc0069697539b707e_7547101337974467153.png',
        3, 8, 0, [0], 5, 1, card => ({
            addDmg: 1 + card.useCnt,
            trigger: ['skill'],
            exec: () => {
                if (card.useCnt < 2) ++card.useCnt;
            }
        }), { uct: 0, isResetUct: true }),

    68: new GICard(68, '公义的酬报', '角色使用｢元素爆发｣造成的伤害+2。；【我方出战角色受到伤害或治疗后：】累积1点｢公义之理｣。如果此牌已累积3点｢公义之理｣，则消耗3点｢公义之理｣，使角色获得1点[充能]。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/000bcdedf14ef6af2cfa36a003841098_4382151758785122038.png',
        2, 8, 0, [0], 5, 1, (card, event) => {
            const { heros = [], hidxs = [], getdmg = [], heal = [] } = event;
            const fhidx = heros.findIndex(h => h.isFront);
            const trigger: Trigger[] = [];
            if (getdmg[fhidx] > 0) trigger.push('getdmg', 'other-getdmg');
            if (heal[fhidx] > 0) trigger.push('heal');
            const hero = heros[hidxs[0]];
            const execmds = isCdt<Cmds[]>(card.useCnt >= 2 && hero.energy < hero.maxEnergy, [{ cmd: 'getEnergy', cnt: 1, hidxs }], [{ cmd: '' }]);
            return {
                addDmgType3: 2,
                trigger,
                execmds,
                exec: () => {
                    if (++card.useCnt >= 3 && hero.energy < hero.maxEnergy) card.useCnt -= 3;
                }
            }
        }, { uct: 0 }),

    81: normalWeapon(81, '旅行剑', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2540a7ead6f2e957a6f25c9899ce428b_3859616323968734996.png'),

    82: jiliWeapon(82, '祭礼剑', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/5dda866add6d4244a69c0ffdd2b53e51_1375735839691106206.png'),

    83: new GICard(83, '风鹰剑', '【角色造成的伤害+1】。；【对方使用技能后：】如果所附属角色为｢出战角色｣，则治疗该角色1点。(每回合至多2次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/fcad55ff202d5dc8fa1d782f0b2f3400_3902557354688808483.png',
        3, 8, 0, [0], 1, 1, (card, event) => {
            const { hidxs } = event;
            return {
                addDmg: 1,
                trigger: ['oppo-skill'],
                execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'heal', cnt: 1, hidxs }]),
                exec: () => {
                    if (card.perCnt > 0) --card.perCnt;
                }
            }
        }, { pct: 2 }),

    84: tiankongWeapon(84, '天空之刃', 1, 'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b3a9cd06298bf6dcd9191a88bb754f14_6317636823354305889.png'),

    85: new GICard(85, '西风剑', '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】角色额外获得1点[充能]。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e1938c4cf6e50cfcb65d67ef10bc16a3_1486330508550781744.png',
        3, 8, 0, [0], 1, 1, card => ({
            addDmg: 1,
            trigger: ['skilltype2'],
            execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getEnergy', cnt: 1 }]),
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 1 }),

    86: new GICard(86, '裁叶萃光', '【角色造成的伤害+1】。；【角色使用｢普通攻击｣后：】生成1个随机的基础元素骰。(每回合最多触发2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/4d3935c7b67e051b02f9a525357b2fb0_8903486552471935304.png',
        3, 8, 0, [0], 1, 1, card => ({
            addDmg: 1,
            trigger: ['skilltype1'],
            execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -1 }]),
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 2 }),

    87: senlin2Weapon(87, '原木刀', 1, 'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/1f97927392b79a716430461251ff53e2_4196794667556484935.png'),

    88: new GICard(88, '静水流涌之辉', '【我方角色受到伤害或治疗后：】此牌累积1点｢湖光｣。；【角色进行｢普通攻击｣时：】如果已有10点｢湖光｣，则消耗10点，使此技能少花费2个[无色元素骰]且造成的伤害+1，并且治疗所附属角色1点。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_Jinshuiliuyong.webp',
        3, 8, 0, [0], 1, 1, (card, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['getdmg', 'heal'];
            if (card.useCnt >= 10) triggers.push('skilltype1');
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 2, 0] }, () => card.useCnt >= 10);
            return {
                trigger: triggers,
                addDmgCdt: isCdt(trigger == 'skilltype1', 1),
                execmds: isCdt<Cmds[]>(card.useCnt >= 10 && trigger == 'skilltype1', [{ cmd: 'heal', cnt: 1 }]),
                ...minusSkillRes,
                exec: () => {
                    if (['getdmg', 'heal'].includes(trigger)) ++card.useCnt;
                    else if (trigger == 'skilltype1') card.useCnt -= 10;
                }
            }
        }, { uct: 0 }),

    101: new GICard(101, '冒险家头带', '【角色使用｢普通攻击｣后：】治疗自身1点(每回合至多3次)。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/c2617ba94c31d82bd4af6df8e74aac91_8306847584147063772.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { hidxs, heros = [] } = event;
            const curHero = heros[hidxs?.[0] ?? -1];
            const notUse = card.perCnt <= 0 || curHero?.maxhp == curHero?.hp;
            return {
                trigger: ['skilltype1'],
                execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 1, hidxs }]),
                exec: () => {
                    if (!notUse) --card.perCnt;
                }
            }
        }, { pct: 3 }),

    102: new GICard(102, '幸运儿银冠', '【角色使用｢元素战技｣后：】治疗自身2点(每回合1次)。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/27d7021e8d3dc0ee1b6f271558179c77_4899141043311513249.png',
        2, 0, 0, [1], 0, 1, (card, event) => {
            const { hidxs, heros = [] } = event;
            const curHero = heros[hidxs?.[0] ?? -1];
            const notUse = card.perCnt <= 0 || curHero?.maxhp == curHero?.hp;
            return {
                trigger: ['skilltype2'],
                execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 2, hidxs }]),
                exec: () => {
                    if (!notUse) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    103: new GICard(103, '游医的方巾', '【角色使用｢元素爆发｣后：】治疗所有我方角色1点(每回合1次)。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/27f34fa09a68f4de71cd8ce12b2ff2ea_7632599925994945499.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [] } = event;
            const notUse = card.perCnt <= 0 || heros?.every(h => h.maxhp == h.hp);
            return {
                trigger: ['skilltype3'],
                execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }]),
                exec: () => {
                    if (!notUse) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    104: new GICard(104, '赌徒的耳环', '【敌方角色被击倒后：】如果所附属角色为｢出战角色｣，则生成2个[万能元素骰]。(整场牌局限制3次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/c36e23e6486cfc14ba1afac19d73620e_6020851449922266352.png',
        1, 8, 0, [1], 0, 1, card => ({
            trigger: ['kill'],
            execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 2, element: 0 }]),
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 3, isResetPct: false }),

    105: new GICard(105, '教官的帽子', '【角色引发元素反应后：】生成1个此角色元素类型的元素骰。(每回合至多3次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/66b3c1346a589e0dea45a58cd4d65c5a_3513743616827517581.png',
        2, 0, 0, [1], 0, 1, card => ({
            trigger: ['elReaction'],
            execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -2 }]),
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 3, isResetPct: false }),

    106: new GICard(106, '流放者头冠', '【角色使用｢元素爆发｣后：】所有后台我方角色获得1点[充能]。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/dd30c7290b9379c5a1a91e0bb5d881c3_4746512653382401326.png',
        2, 0, 0, [1], 0, 1, (card, event) => {
            const { heros = [] } = event;
            const hidxs = heros.map((h, hi) => ({ hi, f: h.isFront, hp: h.hp })).filter(v => !v.f && v.hp > 0).map(v => v.hi);
            return {
                trigger: ['skilltype3'],
                execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getEnergy', cnt: 1, hidxs }]),
                exec: () => {
                    if (card.perCnt > 0) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    107: new GICard(107, '华饰之兜', '【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/82dc7fbd9334da0ca277b234c902a394_6676194364878839414.png',
        1, 8, 0, [1], 0, 1, (_card, event) => {
            const { hidxs = [] } = event;
            return {
                trigger: ['other-skilltype3'],
                execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }],
            }
        }),

    108: new GICard(108, '绝缘之旗印', '【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。；角色使用｢元素爆发｣造成的伤害+2。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/361399b0aa575a2805da6765d3c0e17c_4972333427190668688.png',
        2, 8, 0, [1], 0, 1, (card, event) => {
            const { hidxs = [], trigger = '' } = event;
            return {
                addDmgType3: isCdt(card.perCnt > 0, 2),
                trigger: ['other-skilltype3', 'skilltype3'],
                execmds: isCdt<Cmds[]>(trigger == 'other-skilltype3', [{ cmd: 'getEnergy', cnt: 1, hidxs }]),
                exec: () => {
                    if (trigger == 'other-skilltype3') return;
                    if (card.perCnt > 0) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    109: new GICard(109, '将帅兜鍪', '【行动阶段开始时：】为角色附属｢重嶂不移｣。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/86ed124f5715f96604248a48a57de351_6600927335776465307.png',
        2, 8, 0, [1], 0, 1, () => ({
            trigger: ['phase-start'],
            execmds: [{ cmd: 'getStatus', status: [heroStatus(2050)] }],
        }), { expl: [heroStatus(2050)] }),

    110: new GICard(110, '千岩牢固', '【行动阶段开始时：】为角色附属｢重嶂不移｣。；【角色受到伤害后：】如果所附属角色为｢出战角色｣，则生成1个此角色元素类型的元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/6b1e8983b34f821da73f7a93076a501e_3915605735095366427.png',
        3, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], trigger = '' } = event;
            return {
                trigger: ['phase-start', 'getdmg'],
                execmds: isCdt<Cmds[]>(trigger == 'phase-start', [{ cmd: 'getStatus', status: [heroStatus(2050)] }],
                    isCdt(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: heros[hidxs[0]]?.element ?? 0 }])),
                exec: () => {
                    if (trigger == 'getdmg' && card.perCnt > 0 || heros[hidxs[0]].isFront) --card.perCnt;
                }
            }
        }, { pct: 1, expl: [heroStatus(2050)] }),

    111: new GICard(111, '虺雷之姿', '【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d136fc0fd368a268fe3adaba8c0e64bb_8574805937216108762.png',
        2, 0, 0, [1], 0, 1, (card, event) => {
            const { hcard, heros = [], hidxs = [], trigger = '', minusDiceCard: mdc = 0 } = event;
            const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc && card.perCnt > 0;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => card.perCnt > 0);
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isMinusCard, 1),
                trigger: ['skilltype1', 'card'],
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype1' && isMinusSkill)) {
                        --card.perCnt;
                    }
                }
            }
        }, { pct: 1 }),

    112: new GICard(112, '辰砂往生录', '【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。(每回合1次)；【角色被切换为｢出战角色｣后：】本回合中，角色｢普通攻击｣造成的伤害+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ad8e8b77b4efc4aabd42b7954fbc244c_7518202688884952912.png',
        3, 0, 0, [1], 0, 1, (card, event) => {
            const { hcard, heros = [], hidxs = [], trigger = '', minusDiceCard: mdc = 0 } = event;
            const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc && card.perCnt > 0;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => card.perCnt > 0);
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isMinusCard, 1),
                trigger: ['skilltype1', 'card', 'change-to'],
                execmds: isCdt<Cmds[]>(trigger == 'change-to', [{ cmd: 'getStatus', status: [heroStatus(2072)] }]),
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype1' && isMinusSkill)) {
                        --card.perCnt;
                    }
                }
            }
        }, { pct: 1 }),

    113: new GICard(113, '无常之面', '【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/e2a6d4ad4958d5fff80bb17ec93189ab_7011820758446145491.png',
        2, 0, 0, [1], 0, 1, (card, event) => {
            const { hcard, heros = [], hidxs = [], trigger = '', minusDiceCard: mdc = 0 } = event;
            const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc && card.perCnt > 0;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, () => card.perCnt > 0);
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isMinusCard, 1),
                trigger: ['skilltype2', 'card'],
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusSkill)) {
                        --card.perCnt;
                    }
                }
            }
        }, { pct: 1 }),

    114: new GICard(114, '追忆之注连', '【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。(每回合1次)；【如果角色具有至少2点[充能]，】就使角色｢普通攻击｣和｢元素战技｣造成的伤害+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/48be75f0a23375adb34789dcb1e95a97_850843251536084281.png',
        3, 0, 0, [1], 0, 1, (card, event) => {
            const { hcard, heros = [], hidxs = [], trigger = '', minusDiceCard: mdc = 0 } = event;
            const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc && card.perCnt > 0;
            const isAddDmg = (heros[hidxs[0]]?.energy ?? 0) >= 2;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, () => card.perCnt > 0);
            return {
                addDmgType1: isCdt(isAddDmg, 1),
                addDmgType2: isCdt(isAddDmg, 1),
                ...minusSkillRes,
                minusDiceCard: isCdt(isMinusCard, 1),
                trigger: ['skilltype2', 'card'],
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusSkill)) {
                        --card.perCnt;
                    }
                }
            }
        }, { pct: 1 }),

    115: new GICard(115, '海祇之冠', '我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。(最多累积2个)；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/dfea4a0c2219c145125277f8eddb8269_3306254185680856587.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { trigger = '', heal = [] } = event;
            const allHeal = heal.reduce((a, b) => a + b, 0);
            return {
                trigger: ['dmg', 'heal'],
                addDmgCdt: Math.floor(card.useCnt),
                execmds: isCdt<Cmds[]>(trigger == 'heal', [{ cmd: '' }]),
                exec: () => {
                    if (trigger == 'heal') {
                        if (allHeal > 0) card.useCnt = Math.min(2, card.useCnt + allHeal * 0.34);
                        return;
                    }
                    if (trigger == 'dmg') card.useCnt %= 1;
                }
            }
        }, { uct: 0 }),

    116: new GICard(116, '海染砗磲', '【入场时：】治疗所附属角色2点。；我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。(最多累积2个)；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/16b4765f951281f2547ba40eeb994271_8658397109914249143.png',
        3, 0, 0, [1], 0, 1, (card, event) => {
            const { trigger = '', heal = [] } = event;
            const allHeal = heal.reduce((a, b) => a + b, 0);
            return {
                trigger: ['dmg', 'heal'],
                addDmgCdt: Math.floor(card.useCnt),
                cmds: [{ cmd: 'heal', cnt: 2 }],
                execmds: isCdt<Cmds[]>(trigger == 'heal', [{ cmd: '' }]),
                exec: () => {
                    if (trigger == 'heal') {
                        if (allHeal > 0) card.useCnt = Math.min(2, card.useCnt + allHeal * 0.34);
                        return;
                    }
                    if (trigger == 'dmg') card.useCnt %= 1;
                }
            }
        }, { uct: 0.681 }),

    117: new GICard(117, '沙王的投影', '【入场时：】摸1张牌。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/fe25340f51936207ac2a9e71a8cad87e_3874053549243035788.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isUse = card.perCnt > 0 && heros[hidxs[0]].isFront;
            return {
                trigger: ['elReaction'],
                cmds: [{ cmd: 'getCard', cnt: 1 }],
                execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getCard', cnt: 1 }]),
                exec: () => {
                    if (isUse) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    118: new GICard(118, '饰金之梦', '【入场时：】生成1个所附属角色类型的元素骰。如果我方队伍中存在3种不同元素类型的角色，则改为生成2个。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/b0f1283d8fec75259495c4ef24cc768a_277942760294951822.png',
        3, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isExtra = new Set(heros.map(h => h.element)).size == 3;
            const isUse = card.perCnt > 0 && heros[hidxs[0]]?.isFront;
            return {
                trigger: ['elReaction'],
                cmds: [{ cmd: 'getDice', cnt: isExtra ? 2 : 1, element: heros[hidxs[0]].element }],
                execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getCard', cnt: 1 }]),
                exec: () => {
                    if (isUse) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    119: new GICard(119, '浮溯之珏', '【角色使用｢普通攻击｣后：】摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8ac2175960ea0dace83f9bd76efb70ef_3923530911851671969.png',
        0, 8, 0, [1], 0, 1, card => ({
            trigger: ['skilltype1'],
            execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getCard', cnt: 1 }]),
            exec: () => {
                if (card.perCnt > 0) --card.perCnt;
            }
        }), { pct: 1 }),

    120: new GICard(120, '来歆余响', '【角色使用｢普通攻击｣后：】摸1张牌。(每回合1次)；【角色使用技能后：】如果我方元素骰数量不多于手牌数量，则生成1个所附属角色类型的元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/d9db70a7475940b91d63699e1276678d_8473736559088406285.png',
        2, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], hcards: { length: hcardsCnt } = [], dicesCnt = 0, trigger = '' } = event;
            const isGetCard = trigger == 'skilltype1' && (card.perCnt >> 0 & 1) == 1;
            const isGetDice = trigger.startsWith('skill') && dicesCnt <= hcardsCnt && (card.perCnt >> 1 & 1) == 1;
            const execmds: Cmds[] = [];
            if (isGetCard) execmds.push({ cmd: 'getCard', cnt: 1 });
            if (isGetDice) execmds.push({ cmd: 'getDice', cnt: 1, element: heros[hidxs[0]].element });
            return {
                trigger: ['skill'],
                execmds,
                exec: () => {
                    if (isGetCard) card.perCnt &= ~(1 << 0);
                    if (isGetDice) card.perCnt &= ~(1 << 1);
                }
            }
        }, { pct: 3 }),

    121: new GICard(121, '灵光明烁之心', '【角色受到伤害后：】如果所附属角色为｢出战角色｣，则摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/3a2b86994907366639498965934b1d99_16804113149239958.png',
        0, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isGetCard = card.perCnt > 0 && heros[hidxs[0]].isFront;
            return {
                trigger: ['getdmg'],
                cmds: isCdt<Cmds[]>(isGetCard, [{ cmd: 'getCard', cnt: 1 }]),
                exec: () => {
                    if (isGetCard) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    122: new GICard(122, '花海甘露之光', '【角色受到伤害后：】如果所附属角色为｢出战角色｣，则摸1张牌，并且在本回合结束阶段中治疗所附属角色1点。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/aaaf307c3c9725d0c8f0be7d264e04bd_9827908420304255.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], trigger = '' } = event;
            const isHeal = trigger == 'phase-end' && card.perCnt <= 0;
            const isGetCard = trigger == 'getdmg' && card.perCnt > 0 && heros[hidxs[0]].isFront;
            const execmds = isCdt<Cmds[]>(isHeal, [{ cmd: 'heal', cnt: 1, hidxs }], isCdt(isGetCard, [{ cmd: 'getCard', cnt: 1 }]));
            return {
                trigger: ['getdmg', 'phase-end'],
                execmds,
                exec: () => {
                    if (isGetCard) --card.perCnt;
                }
            }
        }, { pct: 1 }),

    123: new GICard(123, '老兵的容颜', '【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】摸1张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/166e56c3c68e531c97f4fdfde1adde06_4511818010196081435.png',
        2, 0, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], heal = [], trigger = '' } = event;
            const isTriggered = card.perCnt > 0 && (trigger == 'getdmg' || trigger == 'heal' && heal[hidxs[0]] > 0);
            const execmds: Cmds[] = [{ cmd: 'getDice', element: heros[hidxs[0]].element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
            return {
                trigger: ['getdmg', 'heal'],
                execmds: isCdt(isTriggered, [execmds[card.useCnt]]),
                exec: () => {
                    if (isTriggered && ++card.useCnt == 2) {
                        --card.perCnt;
                    }
                }
            }
        }, { uct: 0, pct: 1, isResetUct: true }),

    124: new GICard(124, '逐影猎人', '【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】摸1张牌。；【第三次触发：】生成1个此角色类型的元素骰。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Artifact_ZhuYingDa.webp',
        3, 0, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], heal = [], trigger = '' } = event;
            const isTriggered = card.perCnt > 0 && (trigger == 'getdmg' || trigger == 'heal' && heal[hidxs[0]] > 0);
            const execmds: Cmds[] = [{ cmd: 'getDice', element: heros[hidxs[0]].element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
            return {
                trigger: ['getdmg', 'heal'],
                execmds: isCdt(isTriggered, [execmds[card.useCnt % 2]]),
                exec: () => {
                    if (isTriggered && ++card.useCnt == 3) {
                        --card.perCnt;
                    }
                }
            }
        }, { uct: 0, pct: 1, isResetUct: true }),

    125: new GICard(125, '黄金剧团的奖赏', '【结束阶段：】如果所附属的角色在后台，则此牌累积1点｢报酬｣。(最多累积2点)；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/0f7dfce291215155b3a48a56c8c996c4_3799856037595257577.png',
        0, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], hcard, trigger = '', minusDiceCard: mdc = 0, isSkill = -1 } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, card.useCnt] });
            const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc;
            const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 2 && !heros[hidxs[0]]?.isFront;
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isCardMinus, card.useCnt),
                trigger: ['phase-end', 'card', 'skilltype2'],
                execmds: isCdt<Cmds[]>(isPhaseEnd, [{ cmd: '' }]),
                exec: () => {
                    if (isPhaseEnd) {
                        ++card.useCnt;
                    } else if (trigger == 'card' && isCardMinus) {
                        card.useCnt -= hcard.cost - mdc;
                    } else if (trigger == 'skilltype2' && isMinusSkill) {
                        const skill = heros[hidxs[0]]?.skills[isSkill].cost ?? [{ val: 0 }, { val: 0 }];
                        const skillcost = skill[0].val + skill[1].val;
                        card.useCnt -= skillcost - mdc - minusSkillRes.minusDiceSkill[isSkill].reduce((a, b) => a + b);
                    }
                }
            }
        }, { uct: 0 }),

    126: new GICard(126, '黄金剧团', '【结束阶段：】如果所附属的角色在后台，则此牌累积2点｢报酬｣。(最多累积4点)；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Artifact_Huangjinjutuanda.webp',
        2, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], hcard, trigger = '', minusDiceCard: mdc = 0, isSkill = -1 } = event;
            const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, card.useCnt] });
            const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidxs[0]]?.id && hcard.cost > mdc;
            const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 4 && !heros[hidxs[0]]?.isFront;
            return {
                ...minusSkillRes,
                minusDiceCard: isCdt(isCardMinus, card.useCnt),
                trigger: ['phase-end', 'card', 'skilltype2'],
                execmds: isCdt<Cmds[]>(isPhaseEnd, [{ cmd: '' }]),
                exec: () => {
                    if (isPhaseEnd) {
                        card.useCnt = Math.min(4, card.useCnt + 2);
                    } else if (trigger == 'card' && isCardMinus) {
                        card.useCnt -= hcard.cost - mdc;
                    } else if (trigger == 'skilltype2' && isMinusSkill) {
                        const skill = heros[hidxs[0]]?.skills[isSkill].cost ?? [{ val: 0 }, { val: 0 }];
                        const skillcost = skill[0].val + skill[1].val;
                        card.useCnt -= skillcost - mdc - minusSkillRes.minusDiceSkill[isSkill].reduce((a, b) => a + b);
                    }
                }
            }
        }, { uct: 0 }),

    127: new GICard(127, '紫晶的花冠', '【所附属角色为出战角色，敌方受到[草元素伤害]后：】累积1枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个随机基础元素骰。(每回合至多生成2个)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/e431910b741b3723c64334265ce3e93e_3262613974155239712.png',
        1, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], hcards: { length: hcardsCnt } = [] } = event;
            if (!heros[hidxs[0]]?.isFront) return;
            return {
                trigger: ['grass-getdmg-oppo'],
                execmds: isCdt<Cmds[]>(card.useCnt + 1 >= hcardsCnt && card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -1 }], [{ cmd: '' }]),
                exec: () => {
                    if (++card.useCnt >= hcardsCnt && card.perCnt > 0) --card.perCnt;
                }
            }
        }, { uct: 0, pct: 2 }),

    128: new GICard(128, '乐园遗落之花', '【所附属角色为出战角色，敌方受到[草元素伤害]或发生了[草元素相关反应]后：】累积2枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个[万能元素骰]。(每回合至多生成2个)',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Artifact_ZijinghuaguanDa.webp',
        2, 8, 0, [1], 0, 1, (card, event) => {
            const { heros = [], hidxs = [], hcards: { length: hcardsCnt } = [] } = event;
            if (!heros[hidxs[0]]?.isFront) return;
            return {
                trigger: ['grass-getdmg-oppo', 'el7Reaction'],
                execmds: isCdt<Cmds[]>(card.useCnt + 1 >= hcardsCnt && card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: 0 }], [{ cmd: '' }]),
                exec: () => {
                    card.useCnt += 2;
                    if (card.useCnt >= hcardsCnt && card.perCnt > 0) --card.perCnt;
                }
            }
        }, { uct: 0, pct: 2 }),

    180: normalElArtifact(180, '破冰踏雪的回音', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/65841e618f66c6cb19823657118de30e_3244206711075165707.png'),

    181: advancedElArtifact(181, '冰风迷途的勇士', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/9f6238a08b5844b652365304f05a4e8e_1667994661821497515.png'),

    182: normalElArtifact(182, '酒渍船帽', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/26c4d2daa8a4686107a39f372a2066f3_2037156632546120753.png'),

    183: advancedElArtifact(183, '沉沦之心', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b415a4b00134ee115f7abd0518623f4f_8721743655470015978.png'),

    184: normalElArtifact(184, '焦灼的魔女帽', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/0d841e5b1b0bbf09b8fa1bb7a3e9125b_8584142007202998007.png'),

    185: advancedElArtifact(185, '炽烈的炎之魔女', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/fa55d0e05799d88270cc50bd7148bfcf_3804037770932131779.png'),

    186: normalElArtifact(186, '唤雷的头冠', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/00d958c2d533c85d56613c0d718d9498_7034674946756695515.png'),

    187: advancedElArtifact(187, '如雷的盛怒', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/3c5878d193077253d00e39f6db043270_1544021479773717286.png'),

    188: normalElArtifact(188, '翠绿的猎人之冠', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ab97ddfef51292e8032722be4b90033c_7637964083886847648.png'),

    189: advancedElArtifact(189, '翠绿之影', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b95596e3e5648849048417635b619e2e_2329852964215208759.png'),

    190: normalElArtifact(190, '不动玄石之相', 6, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/886a90f766bcecf0e8812513b7075638_2236001599325966947.png'),

    191: advancedElArtifact(191, '悠古的磐岩', 6, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/977478ceacb3093ecefcf986aeacc1c5_8889340500329632165.png'),

    192: normalElArtifact(192, '月桂的宝冠', 7, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ee4fbb8c86fcc3d54c5e6717b3b62ddb_7264725145151740958.png'),

    193: advancedElArtifact(193, '深林的记忆', 7, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/8c84639efb7e6a9fb445daafdee873fe_8494733884893501982.png'),

    201: new GICard(201, '璃月港口', '【结束阶段：】摸2张牌。；[可用次数]：2。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/c9f669c64195790d3ca31ee6559360ab_669337352006808767.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4003, 201)] })),

    202: new GICard(202, '骑士团图书馆', '【入场时：】选择任意元素骰重投。；【投掷阶段：】获得额外一次重投机会。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/cedc39cd65a6fde9ec51971973328b74_5542237863639059092.png',
        0, 8, 1, [2], 0, 0, () => ({ site: [newSite(4009, 202)], cmds: [{ cmd: 'reroll', cnt: 1 }], })),

    203: new GICard(203, '群玉阁', '【行动阶段开始时：】如果我方手牌数不多于3，则弃置此牌，生成1个[万能元素骰]。；【投掷阶段：】2个元素骰初始总是投出我方出战角色类型的元素。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/a170755e85072e3672834ae9f4d558d5_593047424158919411.png',
        0, 8, 1, [2], 0, 0, () => ({ site: [newSite(4010, 203)] })),

    204: new GICard(204, '晨曦酒庄', '【我方执行行动｢切换角色｣时：】少花费1个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/27ea1b01a7d0011b40c0180e4fba0490_7938002191515673602.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4008, 204)] })),

    205: new GICard(205, '望舒客栈', '【结束阶段：】治疗受伤最多的我方后台角色2点。；[可用次数]：2',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/7ae272a8b40944f34630e0ec54c22317_1223200541912838887.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4006, 205)] })),

    206: new GICard(206, '西风大教堂', '【结束阶段：】治疗我方出战角色2点。；[可用次数]：2',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/e47492f5cf0d78f285c20ac6b38c8ed3_5642129970809736301.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4007, 206)] })),

    207: new GICard(207, '天守阁', '【行动阶段开始时：】如果我方的元素骰包含5种不同的元素，则生成1个[万能元素骰]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6f2b064d7711e30c742b802770bef71_3841942586663095539.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4021, 207)] })),

    208: new GICard(208, '鸣神大社', '【每回合自动触发1次：】生成1个随机的基础元素骰。；[可用次数]：3',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/25bee82daa48f8018a4a921319ca2686_8817000056070129488.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4022, 208)], cmds: [{ cmd: 'getDice', cnt: 1, element: -1 }] })),

    209: new GICard(209, '珊瑚宫', '【结束阶段：】治疗所有我方角色1点。；[可用次数]：2',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2d016c4db4d3ce5c383d4fdb2a33f3e9_8583073738643262052.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4023, 209)] })),

    210: new GICard(210, '须弥城', '【对角色打出｢天赋｣或我方角色使用技能时：】如果我方元素骰数量不多于手牌数量，则少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a659c38687c72bdd6244b9ef3c28390b_972040861793737387.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4024, 210)] })),

    211: new GICard(211, '桓那兰那', '【结束阶段：】收集最多2个未使用的元素骰。；【行动阶段开始时：】拿回此牌所收集的元素骰。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d46d38ef070b2340e8ee9dfa697aad3f_8762501854367946191.png',
        0, 8, 1, [2], 0, 0, () => ({ site: [newSite(4025, 211)] })),

    212: new GICard(212, '镇守之森', '【行动阶段开始时：】如果我方不是｢先手牌手｣，则生成1个出战角色类型的元素骰。；[可用次数]：3',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/5a543775e68a6f02d0ba6526712d32c3_5028743115976906315.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4026, 212)] })),

    213: new GICard(213, '黄金屋', '【我方打出原本元素骰至少为3的｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。(每回合1次)；[可用次数]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b8d17f6fa027ce2ae0d7032daf5b0ee8_2325912171963958867.png',
        0, 8, 1, [2], 0, 0, () => ({ site: [newSite(4027, 213)] })),

    214: new GICard(214, '化城郭', '【我方选择行动前，元素骰为0时：】生成1个[万能元素骰]。(每回合1次)；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/5649867012fe98050232cf0b29c89609_1113164615099773768.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4028, 214)] })),

    215: new GICard(215, '风龙废墟', '【入场时：】从牌组中随机抽取一张｢天赋｣牌。；【我方打出｢天赋｣牌，或我方角色使用原本元素骰消耗至少为4的技能时：】少花费1个元素骰。(每回合1次)；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/1812234f8a4cbd2445ce3bc1387df37c_4843239005964574553.png',
        2, 8, 1, [2], 0, 0, () => ({ site: [newSite(4039, 215)], cmds: [{ cmd: 'getCard', cnt: 1, subtype: 6 }] })),

    216: new GICard(216, '湖中垂柳', '【结束阶段：】如果我方手牌数量不多于2，则抓2张牌。；[可用次数]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/3e8a5c300c5c01f7fedaac87bd641d92_296932138041166470.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4040, 216)] })),

    217: new GICard(217, '欧庇克莱歌剧院', '【我方选择行动前：】如果我方角色所装备卡牌的原本元素骰费用总和不比对方更低，则生成1个出战角色类型的元素骰。(每回合1次)；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/d34719921cedd17675f38dccc24ebf43_8000545229587575448.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4041, 217)] })),

    218: new GICard(218, '梅洛彼得堡', '【我方出战角色受到伤害或治疗后：】此牌累积1点｢禁令｣。(最多累积到4点)；【行动阶段开始时：】如果此牌已有4点｢禁令｣，则消耗4点，在敌方场上生成【严格禁令】。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/41b42ed41f27f21f01858c0cdacd6286_8391561387795885599.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4047, 218)] })),

    219: new GICard(219, '清籁岛', '【任意阵营的角色受到治疗后：】使该角色附属【悠远雷暴】。；[持续回合]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/2bfc84b730feaf6a350373080d97c255_2788497572764739451.png',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4049, 219)] }), { expl: [heroStatus(2184)] }),

    220: new GICard(220, '赤王陵', '【对方累积摸4张牌后：】弃置此牌，在对方牌库顶生成2张【禁忌知识】。然后直到本回合结束前，对方每摸2张牌，就立刻在对方牌库顶生成1张【禁忌知识】。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Assist_Location_ChiWangLin.webp',
        0, 8, 1, [2], 0, 0, () => ({ site: [newSite(4052, 220)] }), { expl: [extraCards[908]] }),

    221: new GICard(221, '中央实验室遗址', '【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢实验进展｣。每当｢实验进展｣达到3点、6点、9点时，就获得1个[万能元素骰]。然后，如果｢实验进展｣至少为9点，则弃置此牌。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Assist_Location_FontaineSci.webp',
        1, 8, 1, [2], 0, 0, () => ({ site: [newSite(4053, 221)] })),

    301: new GICard(301, '派蒙', '【行动阶段开始时：】生成2点[万能元素骰]。；[可用次数]：2。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8b291b7aa846d8e987a9c7d60af3cffb_7229054083686130166.png',
        3, 8, 1, [3], 0, 0, () => ({ site: [newSite(4001, 301)] })),

    302: new GICard(302, '凯瑟琳', '【我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/67cf3f813876e6df62f21dc45c378fa3_4407562376050767664.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4011, 302)] })),

    303: new GICard(303, '蒂玛乌斯', '【入场时：】此牌附带2个｢合成材料｣。如果我方牌组中初始包含至少6张｢圣遗物｣，则从牌组中随机抽取一张｢圣遗物｣牌。；【结束阶段：】补充1个｢合成材料｣。；【打出｢圣遗物｣手牌时：】如可能，则支付等同于｢圣遗物｣总费用数量的｢合成材料｣，以免费装备此｢圣遗物｣(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/839e1884908b6ce5e8bc2d27bde98f20_778730297202034218.png',
        2, 8, 1, [3], 0, 0, (_card, event) => {
            const { playerInfo: { artifactCnt = 0 } = {} } = event;
            return {
                site: [newSite(4012, 303)],
                cmds: isCdt<Cmds[]>(artifactCnt >= 6, [{ cmd: 'getCard', cnt: 1, subtype: 1 }]),
            }
        }),

    304: new GICard(304, '瓦格纳', '【入场时：】此牌附带2个｢锻造原胚｣。如果我方牌组中初始包含至少3种不同的｢武器｣，则从牌组中随机抽取一张｢武器｣牌。；【结束阶段：】补充1个｢锻造原胚｣。；【打出｢武器｣手牌时：】如可能，则支付等同于｢武器｣总费用数量的｢锻造原胚｣，以免费装备此｢武器｣(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/9a47df734f5bd5d52ce3ade67cf50cfa_2013364341657681878.png',
        2, 8, 1, [3], 0, 0, (_card, event) => {
            const { playerInfo: { weaponTypeCnt = 0 } = {} } = event;
            return {
                site: [newSite(4013, 304)],
                cmds: isCdt<Cmds[]>(weaponTypeCnt >= 3, [{ cmd: 'getCard', cnt: 1, subtype: 0 }]),
            }
        }),

    305: new GICard(305, '卯师傅', '【打出｢料理｣事件牌后：】生成1个随机基础元素骰。(每回合1次)；【打出｢料理｣事件牌后：】从牌组中随机抽取1张｢料理｣事件牌。(整场牌局限制1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/430ad3710929867f9a4da3cb40812181_3109488257851299648.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4014, 305)] })),

    306: new GICard(306, '阿圆', '【打出｢场地｣支援牌时：】少花费2个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/0fa92f9ea49deff80274c1c4702e46e3_5650398579643580888.png',
        2, 8, 1, [3], 0, 0, () => ({ site: [newSite(4015, 306)] })),

    307: new GICard(307, '提米', '【每回合自动触发1次：】此牌累积1只｢鸽子｣。；如果此牌已累积3只｢鸽子｣，则弃置此牌，摸1张牌，并生成1点[万能元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/638d754606562a2ff5aa768e9e0008a9_2604997534782710176.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4016, 307)] })),

    308: new GICard(308, '立本', '【结束阶段：】收集我方未使用的元素骰(每种最多1个)。；【行动阶段开始时：】如果此牌已收集3个元素骰，则摸2张牌，生成2点[万能元素骰]，然后弃置此牌。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/dbe203124b2b61d17f0c46523679ee52_7625356549640398540.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4005, 308)] })),

    309: new GICard(309, '常九爷', '【双方角色使用技能后：】如果造成了[物理伤害]、[穿透伤害]或引发了【元素反应】，此牌积累1个｢灵感｣。；如果此牌已积累3个｢灵感｣，弃置此牌并摸2张牌。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/df918cc6348b04d9f287c9b2f429c35c_3616287504640722699.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4004, 309)] })),

    310: new GICard(310, '艾琳', '【我方角色使用本回合使用过的技能时：】少花费1个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8c0a0d6b2fab8ef94f09ed61451ec972_2061140384853735643.png',
        2, 8, 1, [3], 0, 0, () => ({ site: [newSite(4017, 310)] })),

    311: new GICard(311, '田铁嘴', '【结束阶段：】我方一名充能未满的角色获得1点[充能]。(出战角色优先)；[可用次数]：2',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/163adc79a3050ea18fc75293e76f1a13_607175307652592237.png',
        2, 0, 1, [3], 0, 0, () => ({ site: [newSite(4018, 311)] })),

    312: new GICard(312, '刘苏', '【我方切换角色后：】如果切换到的角色没有[充能]，则使该角色获得1点[充能]。(每回合1次)；[可用次数]：2',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/2d2a294488e6a5ecff2af216d1a4a81c_2786433729730992349.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4019, 312)] })),

    313: new GICard(313, '花散里', '【召唤物消失时：】此牌累积1点｢大袚｣进度。(最多累积3点)；【我方打出｢武器｣或｢圣遗物｣装备时：】如果｢大袚｣进度已达到3，则弃置此牌，使打出的卡牌少花费2个元素骰。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/874298075217770b022b0f3a02261a2a_7985920737393426048.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4029, 313)] })),

    314: new GICard(314, '鲸井小弟', '【行动阶段开始时：】生成1点[万能元素骰]。然后，如果对方的支援区未满，则将此牌转移到对方的支援区。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/8d008ff3e1a2b0cf5b4b212e1509726c_1757117943857279627.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4030, 314)] })),

    315: new GICard(315, '旭东', '【打出｢料理｣事件牌时：】少花费2个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a23ea3b4f3cb6b2df59b912bb418f5b8_1362269257088452771.png',
        2, 0, 1, [3], 0, 0, () => ({ site: [newSite(4031, 315)] })),

    316: new GICard(316, '迪娜泽黛', '【打出｢伙伴｣支援牌时：】少花费1个元素骰。(每回合1次)；【打出｢伙伴｣支援牌后：】从牌组中随机抽取1张｢伙牌｣支援牌。(整场牌局限1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f08622b4178df0e2856f22c5e89a5bbb_735371509950287883.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4032, 316)] })),

    317: new GICard(317, '拉娜', '【我方角色使用｢元素战技｣后：】生成1个我方下一个后台角色类型的元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f0c19a49595f68895e309e5bf5760c1f_8058110322505961900.png',
        2, 8, 1, [3], 0, 0, () => ({ site: [newSite(4033, 317)] })),

    318: new GICard(318, '老章', '【我方打出｢武器｣手牌时：】少花费1个元素骰; 我方场上每有一个已装备｢武器｣的角色，就额外少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/c332425d700b588ed93ae01f9817e568_3896726709346713005.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4034, 318)] })),

    319: new GICard(319, '塞塔蕾', '【我方执行任何行动后，手牌数量为0时：】摸1张牌。；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b4a9b32d9ff26697821d3cf0f2444ef7_7283838166930329300.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4035, 319)] })),

    320: new GICard(320, '弥生七月', '【我方打出｢圣遗物｣手牌时：】少花费1个元素骰; 如果我方场上已有2个装备｢圣遗物｣的角色，就额外少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/09820a12324bca69fe30277287462e2f_7162251245504180312.png',
        1, 8, 1, [3], 0, 0, () => ({ site: [newSite(4036, 320)] })),

    321: new GICard(321, '玛梅赫', '【我方打出｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌后：】随机生成1张｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌，将其加入手牌。(每回合1次)；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/eb0cb5b32a8c816b7f13c3d44d0a0fe4_6830305949958078300.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4042, 321)] })),

    322: new GICard(322, '婕德', '此牌会记录本场对局中我方支援区弃置卡牌的数量，称为｢阅历｣。(最多6点)；【我方角色使用｢元素爆发｣后：】如果｢阅历｣至少为6，则弃置此牌，对我方出战角色附属【沙与梦】。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8931597db1022094e0ebdf3e91f5f44c_6917553066022383928.png',
        1, 8, 1, [3], 0, 0, (_card, event) => {
            const { playerInfo: { destroyedSite = 0 } = {} } = event;
            return { site: [newSite(4045, 322, destroyedSite)] }
        }, { expl: [heroStatus(2188)] }),

    323: new GICard(323, '西尔弗和迈勒斯', '此牌会记录本场对局中敌方角色受到过的元素伤害种类数，称为｢侍从的周到｣。(最多4点)；【结束阶段：】如果｢侍从的周到｣至少为3，则弃置此牌，然后摸｢侍从的周到｣点数的牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/e160832e6337e402fc01d5f89c042aa3_8868205734801507533.png',
        1, 8, 1, [3], 0, 0, (_card, event) => {
            const { playerInfo: { oppoGetElDmgType = 0 } = {} } = event;
            let typelist = oppoGetElDmgType;
            let elcnt = 0;
            while (typelist != 0) {
                typelist &= typelist - 1;
                ++elcnt;
            }
            return { site: [newSite(4046, 323, Math.min(4, elcnt))] }
        }),

    324: new GICard(324, '太郎丸', '【入场时：】生成4张【太郎丸的存款】，均匀地置入我方牌库中。；我方打出2张【太郎丸的存款】后：弃置此牌，召唤【愤怒的太郎丸】。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/21981b1c1976bec9d767097aa861227d_6685318429748077021.png',
        2, 0, 1, [3], 0, 0, () => ({ cmds: [{ cmd: 'addCard', cnt: 4, card: 902, element: 1 }], site: [newSite(4050, 324)] }),
        { expl: [extraCards[902], newSummonee(3059)] }),

    325: new GICard(325, '白手套和渔夫', '【结束阶段：】生成1张｢清洁工作｣，随机将其置入我方牌库顶部5张牌之中。；如果此牌的[可用次数]仅剩1次，则摸1张牌。；[可用次数]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/08e6d818575b52bd4459ec98798a799a_2502234583603653928.png',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4051, 325)] }), { expl: [extraCards[903]] }),

    326: new GICard(326, '亚瑟先生', '【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢新闻线索｣。(最多累积到2点)；【结束阶段：】如果此牌已累积2点｢新闻线索｣，则扣除2点，复制对方牌库顶的1张牌加入我方手牌。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Assist_NPC_MrArthur.webp',
        0, 8, 1, [3], 0, 0, () => ({ site: [newSite(4054, 326)] })),

    401: new GICard(401, '参量质变仪', '【双方角色使用技能后：】如果造成了元素伤害，此牌积累1个｢质变进度｣。；此牌已累积3个｢质变进度｣时，弃置此牌并生成3个不同的基础元素骰。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/380f0bb73ffac88a2e8b60a1069a8246_3779576916894165131.png',
        2, 0, 1, [4], 0, 0, () => ({ site: [newSite(4002, 401)] })),

    402: new GICard(402, '便携营养袋', '【入场时：】从牌组中随机抽取1张｢料理｣事件。；【我方打出｢料理｣事件牌时：】从牌组中随机抽取1张｢料理｣事件。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/ab41e76335be5fe031e9d2d6a4bc5cb1_7623544243734791763.png',
        1, 8, 1, [4], 0, 0, () => ({ site: [newSite(4020, 402)], cmds: [{ cmd: 'getCard', cnt: 1, subtype: 5 }] })),

    403: new GICard(403, '红羽团扇', '【我方切换角色后：】本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e48e87cff7b902011afa232be419b12a_7174729288626413060.png',
        2, 8, 1, [4], 0, 0, () => ({ site: [newSite(4037, 403)] })),

    404: new GICard(404, '寻宝仙灵', '【我方角色使用技能后：】此牌累积1个｢寻宝线索｣。；当此牌已累积3个｢寻宝线索｣时，弃置此牌并摸3张牌。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/4321ae941ccf75069eb630547df61e3c_1672242083656433331.png',
        1, 8, 1, [4], 0, 0, () => ({ site: [newSite(4038, 404)] })),

    405: new GICard(405, '化种匣', '【我方打出原本元素骰费用至少为2的支援牌时：】少花费1个元素骰。(每回合1次)；[可用次数]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/3a16ca3da02eaf503cc8169d5e29e938_8021832463219302062.png',
        0, 8, 1, [4], 0, 0, () => ({ site: [newSite(4043, 405)] })),

    406: new GICard(406, '留念镜', '【我方打出｢武器｣/｢圣遗物｣/｢场地｣/｢伙伴｣手牌时：】如果本场对局中我方曾经打出过所打出牌的同名卡牌，则少花费2个元素骰。(每回合1次)；[可用次数]：2',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/aa32049459ce38daffbfe5dc82eb9303_2738230079920133028.png',
        1, 8, 1, [4], 0, 0, () => ({ site: [newSite(4044, 406)] })),

    407: new GICard(407, '流明石触媒', '【我方打出行动牌后：】如果此牌在场期间本回合中我方已打出3张行动牌，则摸1张牌并生成1个[万能元素骰]。(每回合1次)；[可用次数]：3',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/f705b86904d8413be39df62741a8c81e_885257763287819413.png',
        2, 8, 1, [4], 0, 0, () => ({ site: [newSite(4048, 407)] })),

    408: new GICard(408, '苦舍桓', '【行动阶段开始时：】[舍弃]最多2张原本元素骰费用最高的手牌，每[舍弃]1张，此牌就累积1点｢记忆和梦｣。(最多2点)；【我方角色使用技能时：】如果我方本回合未打出过行动牌，则消耗1点｢记忆和梦｣，以使此技能少花费1个元素骰。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Assist_Prop_KuSheHeng.webp',
        0, 8, 1, [4], 0, 0, () => ({ site: [newSite(4055, 408)] })),

    501: new GICard(501, '最好的伙伴！', '将所花费的元素骰转换为2个[万能元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3fc6d26bb7b306296834c0b14abd4bc6_3989407061293772527.png',
        2, 0, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: 0 }] })),

    502: new GICard(502, '换班时间', '【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/c512c490a548f8322503c59c9d87c89a_5960770686347735037.png',
        0, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2010)] })),

    503: new GICard(503, '一掷乾坤', '选择任意元素骰【重投】，可重投2次。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/524d3e5c5e6f3fad28a931abd9c7bb92_2495658906309226331.png',
        0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'reroll', cnt: 2 }] })),

    504: new GICard(504, '运筹帷幄', '摸2张牌。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/88a4ec8b97063fad015a9112ee352a88_3657371852718944273.png',
        1, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getCard', cnt: 2 }] })),

    505: new GICard(505, '本大爷还没有输！', '【本回合有我方角色被击倒，才能打出：】生成1个[万能元素骰]，我方当前出战角色获得1点[充能]。(每回合中，最多只能打出1张此牌)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a1ae1067afcf9899a958c166b7b32fa0_5333005492197066238.png',
        0, 8, 2, [], 0, 0, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            return {
                isValid: !heros[hidxs[0]]?.outStatus.some(ost => ost.id == 2116) && heros.some(h => h.hp == 0),
                cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }, { cmd: 'getEnergy', cnt: 1 }],
                outStatus: [heroStatus(2116)],
            }
        }),

    506: new GICard(506, '交给我吧！', '【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/182f87b4ad80bc18e051098c8d73ba98_7868509334361476394.png',
        0, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2011)] })),

    507: new GICard(507, '鹤归之时', '【我方下一次使用技能后：】将下一个我方后台角色切换到场上。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/4b9215f7e25ed9581698b45f67164395_8716418184979886737.png',
        1, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2017)] })),

    508: new GICard(508, '星天之兆', '我方当前出战角色【获得1点[充能]】。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/e6e557f4dd2762ecb727e14c66bafb57_828613557415004800.png',
        2, 0, 2, [], 0, 0, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const hero = heros[hidxs[0]];
            return { cmds: [{ cmd: 'getEnergy', cnt: 1 }], isValid: (hero?.energy ?? 0) < (hero?.maxEnergy ?? 0) }
        }),

    509: new GICard(509, '白垩之术', '从最多2个我方后台角色身上，转移1点[充能]到我方出战角色。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/567c17051137fdd9e5c981ea584df298_4305321690584111415.png',
        1, 8, 2, [], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            let isNeedEnergy = true;
            let hasEnergy = false;
            heros.forEach(h => {
                if (h.isFront) isNeedEnergy = h.energy < h.maxEnergy;
                else hasEnergy ||= h.energy > 0;
            });
            return {
                isValid: isNeedEnergy && hasEnergy,
                exec: () => {
                    const fhidx = heros.findIndex(h => h.isFront);
                    let getEnergy = 0;
                    let needEnergy = heros[fhidx].maxEnergy - heros[fhidx].energy;
                    for (let i = 1; i < heros.length; ++i) {
                        const h = heros[(i + fhidx) % heros.length];
                        if (needEnergy == 0 || getEnergy >= 2) break;
                        if (h.energy == 0) continue;
                        --h.energy;
                        --needEnergy;
                        ++getEnergy;
                    }
                    heros[fhidx].energy += getEnergy;
                }
            }
        }),

    510: new GICard(510, '诸武精通', '将一个装备在我方角色的｢武器｣装备牌，转移给另一个武器类型相同的我方角色，并重置其效果的｢每回合｣次数限制。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/05625ae4eed490d0958191d8022174cd_5288127036517503589.png',
        0, 8, 2, [], 0, 2, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const selectCnt = heros.filter(h => h.isSelected > 0).length;
            let canSelectHero;
            if (selectCnt == 0) {
                canSelectHero = heros.map(h => h.weaponSlot != null);
            } else if (selectCnt == 1) {
                const selectHero = heros.find(h => h.isSelected == 1);
                canSelectHero = heros.map(h => h.weaponType == selectHero?.weaponType && h.hp > 0);
            } else if (selectCnt == 2) {
                canSelectHero = heros.map(() => false);
            }
            return {
                canSelectHero,
                exec: () => {
                    const [fromHeroIdx, toHeroIdx] = hidxs;
                    const fromHero = heros[fromHeroIdx];
                    const toHero = heros[toHeroIdx];
                    const fromWeapon = fromHero.weaponSlot;
                    if (fromWeapon) {
                        fromHero.weaponSlot = null;
                        cardsTotal(fromWeapon.id).handle(fromWeapon, { reset: true });
                        toHero.weaponSlot = fromWeapon;
                    }
                }
            }
        }),

    511: new GICard(511, '神宝迁宫祝词', '将一个装备在我方角色的｢圣遗物｣装备牌，转移给另一个我方角色，并重置其效果的｢每回合｣次数限制。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a67aefe7f7473b2bc9f602917bad9c5f_6329604065139808609.png',
        0, 8, 2, [], 0, 2, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const selectCnt = heros.filter(h => h.isSelected > 0).length;
            const canSelectHero = selectCnt == 0 ? heros.map(h => h.artifactSlot != null) : heros.map(h => h.hp > 0);
            return {
                canSelectHero,
                exec: () => {
                    const [fromHeroIdx, toHeroIdx] = hidxs;
                    const fromHero = heros[fromHeroIdx];
                    const toHero = heros[toHeroIdx];
                    const fromArtifact = fromHero.artifactSlot;
                    if (fromArtifact) {
                        fromHero.artifactSlot = null;
                        cardsTotal(fromArtifact.id).handle(fromArtifact, { reset: true });
                        toHero.artifactSlot = fromArtifact;
                    }
                }
            }
        }),

    512: new GICard(512, '快快缝补术', '选择一个我方｢召唤物｣，使其[可用次数]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1ede638fa4bb08aef24d03edf5c5d1d9_6232288201967488424.png',
        1, 8, 2, [], 0, 0, (_card, event) => ({
            exec: () => {
                const { summons = [] } = event;
                const selectSmn = summons.find(smn => smn.isSelected);
                if (selectSmn) ++selectSmn.useCnt;
            }
        }), { canSelectSummon: 1 }),

    513: new GICard(513, '送你一程', '选择一个敌方｢召唤物｣，使其[可用次数]-2。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/c0c1b91fe602e0d29159e8ae5effe537_7465992504913868183.png',
        2, 0, 2, [], 0, 0, (_card, event) => ({
            exec: () => {
                const { esummons = [] } = event;
                const selectSmn = esummons.find(smn => smn.isSelected);
                if (selectSmn) selectSmn.useCnt = Math.max(0, selectSmn.useCnt - 2);
            }
        }), { canSelectSummon: 0 }),

    514: new GICard(514, '护法之誓', '消灭所有｢召唤物｣。(不分敌我！)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/9df79dcb5f6faeed4d1f1b286dcaba76_1426047687046512159.png',
        4, 8, 2, [], 0, 0, (_card, event) => ({
            exec: () => {
                const { summons = [], esummons = [] } = event;
                summons.forEach(smn => (smn.useCnt = 0, smn.isDestroy = 0));
                esummons.forEach(smn => (smn.useCnt = 0, smn.isDestroy = 0));
            }
        })),

    515: new GICard(515, '下落斩', '[战斗行动]：切换到目标角色，然后该角色进行｢普通攻击｣。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/a3aa3a8c13499a0c999fc765c4a0623d_2838069371786460200.png',
        3, 8, 2, [7], 0, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            return {
                cmds: [{ cmd: 'switch-to', hidxs }, { cmd: 'useSkill', cnt: 0 }],
                canSelectHero: heros.map(h => !h.isFront && h.hp > 0),
            }
        }),

    516: new GICard(516, '重攻击', '本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/563473c5f59960d334e2105c1571a982_2028527927557315162.png',
        1, 8, 2, [], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            return { inStatus: [heroStatus(2051)], hidxs: [heros?.findIndex(h => h.isFront)] }
        }),

    517: new GICard(517, '温妮莎传奇', '生成4个不同类型的基础元素骰。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/e8473742fd9e3966ccba393f52a1915a_7280949762836305617.png',
        3, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 4, element: -1 }] })),

    518: new GICard(518, '永远的友谊', '牌数小于4的牌手摸牌，直到手牌数各为4张。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/31/183046623/d5a778eb85b98892156d269044c54147_5022722922597227063.png',
        2, 8, 2, [], 0, 0, (_card, event) => {
            const { hcards: { length: hcardsCnt } = [], ehcardsCnt = 0 } = event;
            const cmds: Cmds[] = [];
            if (hcardsCnt < 5) cmds.push({ cmd: 'getCard', cnt: 5 - hcardsCnt });
            if (ehcardsCnt < 4) cmds.push({ cmd: 'getCard', cnt: 4 - ehcardsCnt, isOppo: true });
            return { cmds, isValid: cmds.length > 0 }
        }),

    519: new GICard(519, '大梦的曲调', '【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ebb47b7bd7d4929bbddae2179d46bc28_2360293196273396029.png',
        0, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2052)] })),

    520: new GICard(520, '藏锋何处', '将一个我方角色所装备的｢武器｣返回手牌。；【本回合中，我方下一次打出｢武器｣手牌时：】少花费2个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/888e75a6b80b0f407683eb2af7d25882_7417759921565488584.png',
        0, 8, 2, [], 0, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const hero = heros[hidxs[0]];
            return {
                outStatus: [heroStatus(2053)],
                canSelectHero: heros.map(h => h.weaponSlot != null),
                cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero.weaponSlot, cardsTotal(hero.weaponSlot?.id ?? 0)) }],
                exec: () => { hero.weaponSlot = null },
            }
        }),

    521: new GICard(521, '拳力斗技！', '【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中一位牌手先宣布结束时，未宣布结束的牌手摸2张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/fa58de973ea4811ffe1812487dfb51c4_1089814927914226900.png',
        0, 8, 2, [], 0, 0, (_card, event) => {
            const { dicesCnt = 0, ephase = -1 } = event;
            const isValid = dicesCnt >= 8 && ephase <= 6;
            return { isValid, outStatus: [heroStatus(2101)] }
        }),

    522: new GICard(522, '琴音之诗', '将一个我方角色所装备的｢圣遗物｣返回手牌。；【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c4a398dfed6fe5486f64725f89bb76c_6509340727185201552.png',
        0, 8, 2, [], 0, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const hero = heros[hidxs[0]];
            return {
                outStatus: [heroStatus(2110)],
                canSelectHero: heros.map(h => h.artifactSlot != null),
                cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero.artifactSlot, cardsTotal(hero.artifactSlot?.id ?? 0)) }],
                exec: () => { hero.artifactSlot = null },
            }
        }),

    523: new GICard(523, '野猪公主', '【本回合中，我方每有一张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。(最多获得2个)；(角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/7721cfea320d981f2daa537b95bb7bc1_3900294074977500858.png',
        0, 8, 2, [], 0, 0, () => ({ outStatus: [heroStatus(2148)] })),

    524: new GICard(524, '坍陷与契机', '【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中，双方牌手进行｢切换角色｣行动时需要额外花费1个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/312a021086d348d6e7fed96949b68b64_469348099361246418.png',
        1, 8, 2, [], 0, 0, (_card, event) => {
            const { dicesCnt = 0, ephase = -1 } = event;
            const isValid = dicesCnt >= 8 && ephase <= 6;
            return { isValid, outStatus: [heroStatus(2147)], outStatusOppo: [heroStatus(2147)] };
        }),

    525: new GICard(525, '浮烁的四叶印', '目标角色附属【四叶印】：每个回合的结束阶段，我方都切换到此角色。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/4845ea28326df1869e6385677b360722_5388810612366437595.png',
        0, 8, 2, [], 0, 1, () => ({ inStatus: [heroStatus(2151)] })),

    526: new GICard(526, '机关铸成之链', '【目标我方角色每次受到伤害或治疗后：】累积1点｢备战度｣(最多累积2点)。；【我方打出原本费用不多于｢备战度｣的｢武器｣或｢圣遗物｣时:】移除所有｢备战度｣，以免费打出该牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/51fdd12cc46cba10a8454337b8c2de30_3419304185196056567.png',
        0, 8, 2, [], 0, 1, () => ({ inStatus: [heroStatus(2162)] })),

    527: new GICard(527, '净觉花', '选择一张我方支援区的牌，将其弃置。然后，在我方手牌中随机生成2张支援牌。；【本回合中，我方下次打出支援牌时：】少花费1个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/ce12f855ad452ad6af08c0a4068ec8fb_3736050498099832800.png',
        0, 8, 2, [], 0, 0, (_card, event) => {
            const { site = [] } = event;
            const disidx = site.findIndex(st => st.isSelected);
            site.splice(disidx, 1);
            site.forEach(st => {
                st.canSelect = false;
                st.isSelected = false;
            });
            const cards: Card[] = [];
            for (let i = 0; i < 2; ++i) {
                let c;
                while (!c) c = cardsTotal(Math.ceil(Math.random() * 300 + 200));
                cards.push(c);
            }
            return { outStatus: [heroStatus(2161)], cmds: [{ cmd: 'getCard', cnt: 2, card: cards }] };
        }, { canSelectSite: 1 }),

    528: new GICard(528, '可控性去危害化式定向爆破', '【对方支援区和召唤物区的卡牌数量总和至少为4时，才能打出：】双方所有召唤物的[可用次数]-1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/2e859c0e0c52bfe566e2200bb70dae89_789491720602984153.png',
        1, 8, 2, [], 0, 0, (_card, event) => {
            const { esite = [], summons = [], esummons = [] } = event;
            return {
                isValid: esite.length + esummons.length >= 4,
                exec: () => {
                    summons.forEach(smn => smn.useCnt = Math.max(0, smn.useCnt - 1));
                    esummons.forEach(smn => smn.useCnt = Math.max(0, smn.useCnt - 1));
                }
            }
        }),

    529: new GICard(529, '海中寻宝', '生成6张【海底宝藏】，随机地置入我方牌库中。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/40001dfa11a6aa20be3de16e0c89d598_3587066228917552605.png',
        2, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'addCard', cnt: 6, card: 904 }] }), { expl: [extraCards[904]] }),

    530: magicCount(3, 503),

    561: new GICard(561, '自由的新风', '【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：】1',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/bccf12a9c926bec7203e543c469ac58d_1423280855629304603.png',
        0, 8, 2, [8], 0, 0, () => ({ outStatus: [heroStatus(2054)] })),

    562: new GICard(562, '磐岩盟契', '【我方剩余元素骰数量为0时，才能打出：】生成2个不同的基础元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/194eb0cdc9200aca52848d54b971743f_2099934631074713677.png',
        0, 8, 2, [8], 0, 0, (_card, event) => {
            const { dicesCnt = 10 } = event;
            return { cmds: [{ cmd: 'getDice', cnt: 2, element: -1 }], isValid: dicesCnt == 0 }
        }),
    563: new GICard(563, '旧时庭园', '【我方有角色已装备｢武器｣或｢圣遗物｣时，才能打出：】本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/cd9d8158b2361b984da8c061926bb636_390832108951639145.png',
        0, 8, 2, [8], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const isValid = heros.some(h => h.weaponSlot != null || h.artifactSlot != null);
            return { outStatus: [heroStatus(2055)], isValid }
        }),

    564: new GICard(564, '愉舞欢游', '【我方出战角色的元素类型为‹4冰›/‹1水›/‹2火›/‹3雷›/‹7草›时，才能打出：】对我方所有具有元素附着的角色，附着我方出战角色类型的元素。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/f11867042dd52c75e73d7b2e68b03430_7080334454031898922.png',
        0, 8, 2, [8], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const isValid = [1, 2, 3, 4, 7].includes(heros.find(h => h.isFront)?.element ?? 0);
            const hidxs = heros.map((h, hi) => ({ hi, val: h.attachElement.length > 0 })).filter(v => v.val).map(v => v.hi);
            return { cmds: [{ cmd: 'attach', hidxs, element: -1 }], isValid }
        }),

    565: new GICard(565, '万家灶火', '我方摸【当前回合数-1】数量的牌。(最多摸4张)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c214784418f974b6b3fa294b415cdb4_8205569284186975732.png',
        0, 8, 2, [8], 0, 0, (_card, event) => {
            const { round = 1 } = event;
            return { isValid: round > 1, cmds: [{ cmd: 'getCard', cnt: Math.min(4, round - 1) }] }
        }),

    566: new GICard(566, '裁定之时', '本回合中，对方牌手打出的3张｢事件牌｣无效。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/9ed8846c18cdf85e9b451a702d91c6e8_6360061723145748301.png',
        1, 8, 2, [8], 0, 0, () => ({ outStatusOppo: [heroStatus(2146)] })),

    567: new GICard(567, '抗争之日·碎梦之时', '本回合中，目标我方角色受到的伤害-1。(最多生效4次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/035d9f63a863e8ad26cb6ecf62725411_2229767666746467527.png',
        0, 8, 2, [8], 0, 1, () => ({ inStatus: [heroStatus(2173)] })),

    568: new GICard(568, '旧日鏖战', '【敌方出战角色的[充能]至少为1时，才能打出：】使其[充能]-1.',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Event_Event_LeiShenZhan.webp',
        1, 8, 2, [8], 0, 1, (_card, event) => {
            const { eheros = [] } = event;
            return {
                isValid: (eheros.find(h => h.isFront)?.energy ?? 0) > 0,
                cmds: [{ cmd: 'getEnergy', cnt: -1, isOppo: true }],
            }
        }),

    570: new GICard(570, '深渊的呼唤', '召唤一个随机｢丘丘人｣召唤物！',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/011610bb3aedb5dddfa1db1322c0fd60_7383120485374723900.png',
        2, 8, 2, [-3], 0, 0, (_card, event) => {
            const { summons = [] } = event;
            const smnIds = [3010, 3011, 3012, 3013].filter(sid => !summons.some(smn => smn.id === sid));
            return { summon: [newSummonee(smnIds[Math.floor(Math.random() * smnIds.length)])] }
        },
        { expl: [newSummonee(3010), newSummonee(3011), newSummonee(3012), newSummonee(3013)] }),

    571: new GICard(571, '风与自由', '【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/5a34fd4bfa32edfe062f0f6eb76106f4_4397297165227014906.png',
        0, 8, 2, [-3], 0, 0, () => ({ outStatus: [heroStatus(2056)] })),

    572: new GICard(572, '岩与契约', '【下回合行动阶段开始时：】生成3点[万能元素骰]，并摸1张牌。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/7ffbf85a7089e25fc48f6a48826e1fa4_183114830191275147.png',
        3, 0, 2, [-3], 0, 0, () => ({ outStatus: [heroStatus(2057)] })),

    573: new GICard(573, '雷与永恒', '将我方所有元素骰转换为[万能元素骰]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/760c101ed6ef3b500a830ae430458d89_4230653799114143139.png',
        0, 8, 2, [-3], 0, 0, () => ({ cmds: [{ cmd: 'changeDice', element: 0 }] })),

    574: new GICard(574, '草与智慧', '摸1张牌。然后，选择任意手牌替换。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/1c656067801c6beb53803faefedd0a47_7333316108362576471.png',
        1, 8, 2, [-3], 0, 0, () => ({ cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'changeCard', cnt: 2500 }] })),

    575: new GICard(575, '水与正义', '平均分配我方未被击倒的角色的生命值，然后治疗所有我方角色1点。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Event_Event_WaterJustice.webp',
        1, 8, 2, [-3], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidxs = allHidxs(heros);
            if (hidxs.length > 1) {
                const allHp = heros.reduce((a, c) => c.hp > 0 ? a + c.hp : a, 0);
                const baseHp = Math.floor(allHp / hidxs.length);
                let restHp = allHp - baseHp;
                const hidx = heros.findIndex(h => h.isFront);
                for (let i = 0; i < heros.length; ++i) {
                    heros[hidx + i].hp = baseHp + (restHp > 0 ? 1 : 0);
                    if (restHp > 0) --restHp;
                }
            }
            return { cmds: [{ cmd: 'heal', cnt: 1, hidxs }] }
        }),

    578: new GICard(578, '愚人众的阴谋', '在对方场上，生成1个随机类型的｢愚人众伏兵｣。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/388f7b09c6abb51bf35cdf5799b20371_5031929258147413659.png',
        2, 8, 2, [-3], 0, 0, (_card, event) => {
            const { eheros = [] } = event;
            const stsIds = [2124, 2125, 2126, 2127].filter(sid => !eheros.find(h => h.isFront)?.outStatus.some(sts => sts.id === sid));
            return { outStatusOppo: [heroStatus(stsIds[Math.floor(Math.random() * stsIds.length)])] }
        }, { expl: [heroStatus(2124), heroStatus(2125), heroStatus(2126), heroStatus(2127)] }),

    581: elCard(581, 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/4111a176d3936db8220047ff52e37c40_264497451263620555.png'),

    582: new GICard(582, '元素共鸣：愈疗之水', '治疗我方出战角色2点。然后，治疗我方所有后台角色1点。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/2735fa558713779ca2f925701643157a_7412042337637299588.png',
        1, 1, 2, [9], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const fhidxs: number[] = [];
            const bhidxs: number[] = [];
            heros.forEach((h, hi) => {
                if (h.isFront) fhidxs.push(hi);
                else if (h.hp > 0) bhidxs.push(hi);
            });
            return {
                cmds: [
                    { cmd: 'heal', cnt: 2, hidxs: fhidxs },
                    { cmd: 'heal', cnt: 1, hidxs: bhidxs },
                ],
                isValid: heros.some(h => h.hp < h.maxhp),
            }
        }),

    583: elCard(583, 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/a37ec2ccbb719551f14586a51609a049_6190862804933467057.png'),

    584: new GICard(584, '元素共鸣：热诚之火', '本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/82515ce0a16de7f3fba6e02232545230_5475039957819136120.png',
        1, 2, 2, [9], 0, 0, (_card, event) => {
            const hidxs: number[] = [event?.heros?.findIndex(h => h.isFront) ?? -1];
            return { inStatus: [heroStatus(2029)], hidxs }
        }),

    585: elCard(585, 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/d7a7653168cd80943a50578aa1251f7a_1527724411934371635.png'),

    586: new GICard(586, '元素共鸣：强能之雷', '我方一名充能未满的角色获得1点[充能]。(出战角色优先)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/24c0eec5aa696696abeacd2a9ab2e443_2548840222933909920.png',
        1, 3, 2, [9], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidxs: number[] = [];
            const frontHeroIdx = heros.findIndex(h => h.isFront);
            if (frontHeroIdx > -1 && heros[frontHeroIdx].energy < heros[frontHeroIdx].maxEnergy) {
                hidxs.push(frontHeroIdx);
            } else {
                const hidx = heros.findIndex(h => h.energy < h.maxEnergy);
                if (hidx > -1) hidxs.push(hidx);
            }
            return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], hidxs }
        }),

    587: elCard(587, 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3c2290805dd2554703ca4c5be3ae6d8a_7656625119620764962.png'),

    588: new GICard(588, '元素共鸣：粉碎之冰', '本回合中，我方当前出战角色下一次造成的伤害+2。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75833613/4bbbf27e898aeace567039c5c2bb2a7c_4533106343661611310.png',
        1, 4, 2, [9], 0, 0, (_card, event) => {
            const hidxs: number[] = [event?.heros?.findIndex(h => h.isFront) ?? -1];
            return { inStatus: [heroStatus(2030)], hidxs }
        }),

    589: elCard(589, 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f3fdbb9e308bfd69c04aa4e6681ad71d_7543590216853591638.png'),

    590: new GICard(590, '元素共鸣：迅捷之风', '切换到目标角色，并生成1点[万能元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/707f537df32de90d61b3ac8e8dcd4daf_7351067372939949818.png',
        1, 5, 2, [9], 0, 1, (_card, event) => {
            const { hidxs = [], heros = [] } = event;
            return {
                cmds: [{ cmd: 'switch-to', hidxs }, { cmd: 'getDice', cnt: 1, element: 0 }],
                canSelectHero: heros.map(h => !h.isFront && h.hp > 0),
            }
        }),

    591: elCard(591, 6, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/cdd36a350467dd02ab79a4c49f07ba7f_4199152511760822055.png'),

    592: new GICard(592, '元素共鸣：坚定之岩', '本回合中，我方角色下一次造成[岩元素伤害]后：如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/504be5406c58bbc3e269ceb8780eaa54_8358329092517997158.png',
        1, 6, 2, [9], 0, 0, () => ({ outStatus: [heroStatus(2031)] })),

    593: elCard(593, 7, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f6109c65a24602b1ad921d5bd5f94d97_2028353267602639806.png'),

    594: new GICard(594, '元素共鸣：蔓生之草', '本回合中，我方角色下一次引发元素反应时，造成的伤害+2。；使我方场上的｢燃烧烈焰｣、｢草原核｣和｢激化领域｣[可用次数]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/af52f6c4f7f85bb3d3242778dc257c5c_1159043703701983776.png',
        1, 7, 2, [9], 0, 0, (_card, event) => {
            const { heros = [], summons = [] } = event;
            return {
                outStatus: [heroStatus(2032)],
                exec: () => {
                    const outStatus = heros.find(h => h.isFront)?.outStatus ?? [];
                    outStatus.forEach(ost => {
                        if (ost.id == 2005 || ost.id == 2006) ++ost.useCnt;
                    });
                    summons.forEach(smn => {
                        if (smn.id == 3002) ++smn.useCnt;
                    });
                }
            }
        }),

    601: new GICard(601, '绝云锅巴', '本回合中，目标角色下一次｢普通攻击｣造成的伤害+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1e59df2632c1822d98a24047f97144cd_5355214783454165570.png',
        0, 8, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2014), heroStatus(2009)] })),

    602: new GICard(602, '仙跳墙', '本回合中，目标角色下一次｢元素爆发｣造成的伤害+3。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/d5f601020016ee5b999837dc291dc939_1995091421771489590.png',
        2, 0, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2015), heroStatus(2009)] })),

    603: new GICard(603, '莲花酥', '本回合中，目标角色下次受到的伤害-3。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3df4388cf37da743d62547874329e020_8062215832659512862.png',
        1, 8, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2018), heroStatus(2009)] })),

    604: new GICard(604, '北地烟熏鸡', '本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bea77758f2b1392abba322e54cb43dc4_7154513228471011328.png',
        0, 8, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2021), heroStatus(2009)] })),

    605: new GICard(605, '甜甜花酿鸡', '治疗目标角色1点。(每回合每个角色最多食用1次｢料理｣)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bb5528c89decc6e54ade58e1c672cbfa_4113972688843190708.png',
        0, 8, 2, [5], 0, 1, (_card, event) => {
            const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], inStatus: [heroStatus(2009)], canSelectHero }
        }),

    606: new GICard(606, '蒙德土豆饼', '治疗目标角色2点。(每回合每个角色最多食用1次｢料理｣)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/f1026f0a187267e7484d04885e62558a_1248842015783359733.png',
        1, 8, 2, [5], 0, 1, (_card, event) => {
            const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
            return { cmds: [{ cmd: 'heal', cnt: 2 }], inStatus: [heroStatus(2009)], canSelectHero }
        }),

    607: new GICard(607, '烤蘑菇披萨', '治疗目标角色1点，两回合内结束阶段再治疗此角色1点。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/915af5fee026a95d6001559c3a1737ff_7749997812479443913.png',
        1, 8, 2, [5], 0, 1, (_card, event) => {
            const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], inStatus: [heroStatus(2016), heroStatus(2009)], canSelectHero }
        }),

    608: new GICard(608, '兽肉薄荷卷', '目标角色在本回合结束前，之后的三次｢普通攻击｣都少花费1个[无色元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/02a88d1110794248403455ca8a872a96_7596521902301090637.png',
        1, 8, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2019), heroStatus(2009)] })),

    609: new GICard(609, '提瓦特煎蛋', '复苏目标角色，并治疗此角色1点。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/981cc0d2da6a2dc2b535b1ee25a77622_592021532068551671.png',
        2, 8, 2, [-2, 5], 0, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isRevived = heros[hidxs[0]].outStatus.some(ist => ist.id == 2022);
            const canSelectHero = heros.map(h => h.hp <= 0 && !isRevived);
            return {
                cmds: [{ cmd: 'revive', cnt: 1 }],
                inStatus: [heroStatus(2009)],
                outStatus: [heroStatus(2022)],
                canSelectHero,
            }
        }),

    610: new GICard(610, '刺身拼盘', '目标角色在本回合结束前，｢普通攻击｣造成的伤害+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/66806f78b2ced1ea0be9b888d912a61a_8814575863313174324.png',
        1, 8, 2, [5], 0, 1, () => ({ inStatus: [heroStatus(2023), heroStatus(2009)] })),

    611: new GICard(611, '唐杜尔烤鸡', '本回合中，所有我方角色下一次｢元素战技｣造成的伤害+2。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/ebc939f0b5695910118e65f9acfc95ff_8938771284871719730.png',
        2, 0, 2, [5], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 2009) && h.hp > 0 }))
                .filter(v => v.val).map(v => v.hi);
            return { inStatus: [heroStatus(2024), heroStatus(2009)], hidxs }
        }),

    612: new GICard(612, '黄油蟹蟹', '本回合中，所有我方角色下次受到伤害-2。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/371abd087dfb6c3ec9435668d927ee75_1853952407602581228.png',
        2, 0, 2, [5], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 2009) && h.hp > 0 }))
                .filter(v => v.val).map(v => v.hi);
            return { inStatus: [heroStatus(2025), heroStatus(2009)], hidxs }
        }),

    613: new GICard(613, '炸鱼薯条', '本回合中，所有我方角色下次使用技能时少花费1个元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/21ece93fa784b810495128f6f0b14c59_4336812734349949596.png',
        2, 0, 2, [5], 0, 0, (_card, event) => {
            const { heros = [] } = event;
            const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 2009) && h.hp > 0 }))
                .filter(v => v.val).map(v => v.hi);
            return { inStatus: [heroStatus(2152), heroStatus(2009)], hidxs }
        }),

    614: new GICard(614, '松茸酿肉卷', '治疗目标角色2点，3回合内结束阶段再治疗此角色1点。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/9001508071c110f4b13088edeb22c8b4_7346504108686077875.png',
        2, 8, 2, [5], 0, 1, (_card, event) => {
            const { heros = [] } = event;
            const canSelectHero = heros.map(h => h.hp < h.maxhp);
            return { cmds: [{ cmd: 'heal', cnt: 2 }], inStatus: [heroStatus(2159), heroStatus(2009)], canSelectHero }
        }),

    615: new GICard(615, '缤纷马卡龙', '治疗目标角色1点，该角色接下来3次受到伤害后再治疗其1点。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/287f535c9a60620259bb149a75a3a001_7028948017645858669.png',
        2, 0, 2, [5], 0, 1, (_card, event) => {
            const { heros = [] } = event;
            const canSelectHero = heros.map(h => h.hp < h.maxhp);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], inStatus: [heroStatus(2186), heroStatus(2009)], canSelectHero }
        }),

    701: new GICard(701, '唯此一心', '[战斗行动]：我方出战角色为【甘雨】时，装备此牌。；【甘雨】装备此牌后，立刻使用一次【霜华矢】。；装备有此牌的【甘雨】使用【霜华矢】时：如果此技能在本场对局中曾经被使用过，则其对敌方后台角色造成的[穿透伤害]改为3点。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/15a100ee0285878fc5749663031fa05a_7762319984393418259.png',
        5, 4, 0, [6, 7], 1001, 1, talentSkill(2), { expl: talentExplain(1001, 2) }),

    702: new GICard(702, '寒天宣命祝词', '装备有此牌的【神里绫华】生成的[冰元素附魔]会使所附魔角色造成的[冰元素伤害]+1。；切换到装备有此牌的【神里绫华】时：少花费1个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7d706fd25ab0b3c4f8cca3af08d8a07b_2913232629544868049.png',
        2, 4, 0, [6], 1005, 1, (card, event) => ({
            trigger: ['change-to'],
            minusDiceHero: card.perCnt,
            exec: () => {
                let { changeHeroDiceCnt = 0 } = event;
                if (card.perCnt > 0 && changeHeroDiceCnt > 0) {
                    --card.perCnt;
                    --changeHeroDiceCnt;
                }
                return { changeHeroDiceCnt }
            },
        }), { pct: 1 }),

    703: new GICard(703, '重帘留香', '[战斗行动]：我方出战角色为【行秋】时，装备此牌。；【行秋】装备此牌后，立刻使用一次【画雨笼山】。；装备有此牌的【行秋】生成的【雨帘剑】，会在我方出战角色受到至少为2的伤害时抵消伤害，并且初始[可用次数]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/eb3cd31f7a2c433499221b5664a264f3_3086723857644931388.png',
        3, 1, 0, [6, 7], 1102, 1, talentSkill(1), { expl: talentExplain(1102, 1) }),

    704: new GICard(704, '沉没的预言', '[战斗行动]：我方出战角色为【莫娜】时，装备此牌。；【莫娜】装备此牌后，立刻使用一次【命定星轨】。；装备有此牌的【莫娜】出战期间，我方引发的[水元素相关反应]伤害额外+2。',
        'https://patchwiki.biligame.com/images/ys/d/de/1o1lt07ey988flsh538t7ywvnpzvzjk.png',
        3, 1, 0, [6, 7], 1103, 1, (_card, event) => talentHandle(event, 2, () => {
            const { heros = [], hidxs = [] } = event;
            return [() => ({}), { addDmgCdt: isCdt(heros[hidxs[0]]?.isFront, 2) }]
        }, 'el1Reaction'), { expl: talentExplain(1103, 2), energy: 3 }),

    705: new GICard(705, '流火焦灼', '[战斗行动]：我方出战角色为【迪卢克】时，装备此牌。；【迪卢克】装备此牌后，立刻使用一次【逆焰之刃】。；装备有此牌的【迪卢克】每回合第2次使用【逆焰之刃】时，少花费1个[火元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/5d72a776e175c52de3c4ebb113f2b9e7_2138984540269318755.png',
        3, 2, 0, [6, 7], 1201, 1, (_card, event) => talentHandle(event, 1, () => {
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, skill => skill.useCnt == 1);
            return [() => ({}), { ...minusSkillRes }]
        }), { expl: talentExplain(1201, 1) }),

    706: new GICard(706, '混元熵增论', '[战斗行动]：我方出战角色为【砂糖】时，装备此牌。；【砂糖】装备此牌后，立刻使用一次【禁·风灵作成·柒伍同构贰型】。；装备有此牌的【砂糖】生成的【大型风灵】已转换成另一种元素后：我方造成的此类元素伤害+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/93fb13495601c24680e2299f9ed4f582_2499309288429565866.png',
        3, 5, 0, [6, 7], 1401, 1, talentSkill(2), { expl: talentExplain(1401, 2), energy: 2 }),

    707: new GICard(707, '蒲公英的国土', '[战斗行动]：我方出战角色为【琴】时，装备此牌。；【琴】装备此牌后，立刻使用一次【蒲公英之风】。；装备有此牌的【琴】在场时，【蒲公英领域】会使我方造成的[风元素伤害]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4e162cfa636a6db51f166d7d82fbad4f_6452993893511545582.png',
        4, 5, 0, [6, 7], 1402, 1, talentSkill(2), { expl: talentExplain(1402, 2), energy: 2 }),

    708: new GICard(708, '交叉火力', '[战斗行动]：我方出战角色为【香菱】时，装备此牌。；【香菱】装备此牌后，立刻使用一次【锅巴出击】。；装备有此牌的【香菱】施放【锅巴出击】时，自身也会造成1点[火元素伤害]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/101e8ef859847643178755f3bcacbad5_4705629747924939707.png',
        3, 2, 0, [6, 7], 1202, 1, talentSkill(1), { expl: talentExplain(1202, 1) }),

    709: new GICard(709, '噬星魔鸦', '[战斗行动]：我方出战角色为【菲谢尔】时，装备此牌。；【菲谢尔】装备此牌后，立刻使用一次【夜巡影翼】。；装备有此牌的【菲谢尔】生成的【奥兹】，会在【菲谢尔】｢普通攻击｣后造成2点[雷元素伤害]。(需消耗[可用次数])',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/95879bb5f97234a4af1210b522e2c948_1206699082030452030.png',
        3, 3, 0, [6, 7], 1301, 1, talentSkill(1), { expl: talentExplain(1301, 1) }),

    710: new GICard(710, '储之千日，用之一刻', '[战斗行动]：我方出战角色为【凝光】时，装备此牌。；【凝光】装备此牌后，立刻使用一次【璇玑屏】。；装备有此牌的【凝光】在场时，【璇玑屏】会使我方造成的[岩元素伤害]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/8b72e98d01d978567eac5b3ad09d7ec1_7682448375697308965.png',
        4, 6, 0, [6, 7], 1501, 1, talentSkill(1), { expl: talentExplain(1501, 1) }),

    711: new GICard(711, '飞叶迴斜', '[战斗行动]：我方出战角色为【柯莱】时，装备此牌。；【柯莱】装备此牌后，立刻使用一次【拂花偈叶】。；装备有此牌的【柯莱】使用了【拂花偈叶】的回合中，我方角色的技能引发[草元素相关反应]后：造成1点[草元素伤害]。(每回合1次)',
        'https://patchwiki.biligame.com/images/ys/0/01/6f79lc4y34av8nsfwxiwtbir2g9b93e.png',
        4, 7, 0, [6, 7], 1601, 1, talentSkill(1), { expl: talentExplain(1601, 1) }),

    712: new GICard(712, '猫爪冰摇', '[战斗行动]：我方出战角色为【迪奥娜】时，装备此牌。；【迪奥娜】装备此牌后，立刻使用一次【猫爪冻冻】。；装备有此牌的【迪奥娜】生成的【猫爪护盾】，所提供的[护盾]值+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/cb37f02217bcd8ae5f6e4a6eb9bae539_3357631204660850476.png',
        3, 4, 0, [6, 7], 1002, 1, talentSkill(1), { expl: talentExplain(1002, 1) }),

    713: new GICard(713, '冒险憧憬', '[战斗行动]：我方出战角色为【班尼特】时，装备此牌。；【班尼特】装备此牌后，立刻使用一次【美妙旅程】。；装备有此牌的【班尼特】生成的【鼓舞领域】，其伤害提升效果改为总是生效，不再具有生命值限制。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/044617980be5a70980f7826036963e74_8167452876830335549.png',
        4, 2, 0, [6, 7], 1203, 1, talentSkill(2), { expl: talentExplain(1203, 2), energy: 2 }),

    714: new GICard(714, '觉醒', '[战斗行动]：我方出战角色为【雷泽】时，装备此牌。；【雷泽】装备此牌后，立刻使用一次【利爪与苍雷】。；装备有此牌的【雷泽】使用【利爪与苍雷】后：使我方一个‹3雷元素›角色获得1点[充能]。(出战角色优先，每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7b07468873ea01ee319208a3e1f608e3_1769364352128477547.png',
        3, 3, 0, [6, 7], 1302, 1,
        (card, event) => talentHandle(event, 1, () => {
            const { heros = [], hidxs = [] } = event;
            const nhidxs: number[] = [];
            for (let i = 0; i < heros.length; ++i) {
                const hidx = (i + hidxs[0]) % heros.length;
                const hero = heros[hidx];
                if (hero.hp > 0 && hero.element == 3 && hero.energy < hero.maxEnergy) {
                    nhidxs.push(hidx);
                    break;
                }
            }
            const isUse = card.perCnt > 0 && nhidxs.length > 0;
            return [() => {
                if (isUse) --card.perCnt;
            }, { execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getEnergy', cnt: 1, hidxs: nhidxs }]) }]
        }), { pct: 1, expl: talentExplain(1302, 1) }),

    715: new GICard(715, '支援就交给我吧', '[战斗行动]：我方出战角色为【诺艾尔】时，装备此牌。；【诺艾尔】装备此牌后，立刻使用一次【护心铠】。；装备有此牌的【诺艾尔】｢普通攻击｣后：如果此牌和【护体岩铠】仍在场，治疗我方所有角色1点。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4c6332fd42d6edc64633a44aa900b32f_248861550176006555.png',
        3, 6, 0, [6, 7], 1502, 1,
        (card, event) => talentHandle(event, 1, () => {
            const { heros = [], hidxs: hi = [] } = event;
            const isHeal = heros[hi[0]]?.outStatus.some(ost => ost.id == 2036) && card.perCnt > 0;
            const hidxs = allHidxs(heros);
            return [() => {
                if (isHeal) --card.perCnt;
            }, { execmds: isCdt<Cmds[]>(isHeal, [{ cmd: 'heal', cnt: 1, hidxs }]) }]
        }, 'skilltype1'), { pct: 1, expl: talentExplain(1502, 1) }),

    716: new GICard(716, '光辉的季节', '[战斗行动]：我方出战角色为【芭芭拉】时，装备此牌。；【芭芭拉】装备此牌后，立刻使用一次【演唱，开始♪】。；装备有此牌的【芭芭拉】在场时，【歌声之环】会使我方执行｢切换角色｣行动时少花费1个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/a0b27dbfb223e2fe52b7362ad80c3d76_4257766629162615403.png',
        3, 1, 0, [6, 7], 1101, 1,
        (card, event) => talentHandle(event, 1, () => {
            let { summons = [], changeHeroDiceCnt = 0 } = event;
            const isMinus = card.perCnt > 0 && summons.some(smn => smn.id == 3015);
            return [() => {
                if (changeHeroDiceCnt > 0 && isMinus) {
                    --card.perCnt;
                    --changeHeroDiceCnt;
                }
                return { changeHeroDiceCnt }
            }, { minusDiceHero: isCdt(isMinus, 1) }]
        }, 'change'), { pct: 1, expl: talentExplain(1101, 1) }),

    717: new GICard(717, '冷血之剑', '[战斗行动]：我方出战角色为【凯亚】时，装备此牌。；【凯亚】装备此牌后，立刻使用一次【霜袭】。；装备有此牌的【凯亚】使用【霜袭】后：治疗自身2点。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/616ba40396a3998560d79d3e720dbfd2_3275119808720081204.png',
        4, 4, 0, [6, 7], 1003, 1,
        (card, event) => talentHandle(event, 1, () => {
            const { hidxs = [] } = event;
            const hdres = card.perCnt > 0 ? { heal: 2, hidxs } : {}
            return [() => {
                if (card.perCnt <= 0) return;
                --card.perCnt;
                return { ...hdres, cmds: [{ cmd: 'heal', cnt: 2, hidxs }] }
            }, hdres]
        }), { pct: 1, expl: talentExplain(1003, 1) }),

    718: new GICard(718, '吐纳真定', '[战斗行动]：我方出战角色为【重云】时，装备此牌。；【重云】装备此牌后，立刻使用一次【重华叠霜】。；装备有此牌的【重云】生成的【重华叠霜领域】获得以下效果：；使我方单手剑、双手剑或长柄武器角色的｢普通攻击｣伤害+1。',
        'https://patchwiki.biligame.com/images/ys/e/e6/qfsltpvntkjxioew81iehfhy5xvl7v6.png',
        3, 4, 0, [6, 7], 1004, 1, talentSkill(1), { expl: talentExplain(1004, 1) }),

    719: new GICard(719, '长野原龙势流星群', '[战斗行动]：我方出战角色为【宵宫】时，装备此牌。；【宵宫】装备此牌后，立刻使用一次【焰硝庭火舞】。；装备有此牌的【宵宫】生成的【庭火焰硝】初始[可用次数]+1，触发【庭火焰硝】后：额外造成1点[火元素伤害]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/126c63df7d92e7d9c0a815a7a54558fc_6536428182837399330.png',
        2, 2, 0, [6, 7], 1204, 1, talentSkill(1), { expl: talentExplain(1204, 1) }),

    720: new GICard(720, '抵天雷罚', '[战斗行动]：我方出战角色为【刻晴】时，装备此牌。；【刻晴】装备此牌后，立刻使用一次【星斗归位】。；装备有此牌的【刻晴】生成的[雷元素附魔]获得以下效果：初始持续回合+1，并且会使所附属角色造成的[雷元素伤害]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/58e4a4eca066cc26e6547f590def46ad_1659079510132865575.png',
        3, 3, 0, [6, 7], 1303, 1, talentSkill(1), { expl: talentExplain(1303, 1) }),

    721: new GICard(721, '百川奔流', '[战斗行动]：我方出战角色为【纯水精灵·洛蒂娅】时，装备此牌。；【纯水精灵·洛蒂娅】装备此牌后，立刻使用一次【潮涌与激流】。；装备有此牌的【纯水精灵·洛蒂娅】施放【潮涌与激流】时：使我方所有召唤物[可用次数]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b1a0f699a2168c60bc338529c3dee38b_3650391807139860687.png',
        4, 1, 0, [6, 7], 1721, 1, talentSkill(3), { expl: talentExplain(1721, 3), energy: 3 }),

    722: new GICard(722, '镜锢之笼', '[战斗行动]：我方出战角色为【愚人众·藏镜仕女】时，装备此牌。；【愚人众·藏镜仕女】装备此牌后，立刻使用一次【潋波绽破】。；装备有此牌的【愚人众·藏镜仕女】生成的【水光破镜】获得以下效果：；初始持续回合+1，并且会使所附属角色切换到其他角色时元素骰费用+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/b0294bbab49b071b0baa570bc2339917_4550477078586399854.png',
        3, 1, 0, [6, 7], 1722, 1, talentSkill(1), { expl: talentExplain(1722, 1) }),

    723: new GICard(723, '悉数讨回', '[战斗行动]：我方出战角色为【愚人众·火之债务处理人】时，装备此牌。；【愚人众·火之债务处理人】装备此牌后，立刻使用一次【伺机而动】。；装备有此牌的【愚人众·火之债务处理人】生成的【潜行】获得以下效果：；初始持续回合+1，并且使所附属角色造成的[物理伤害]变为[火元素伤害]。',
        'https://patchwiki.biligame.com/images/ys/4/4b/p2lmo1107n5nwc2pulpjkurlixa2o4h.png',
        3, 2, 0, [6, 7], 1741, 1, talentSkill(1), { expl: talentExplain(1741, 1) }),

    724: new GICard(724, '机巧神通', '[战斗行动]：我方出战角色为【魔偶剑鬼】时，装备此牌。；【魔偶剑鬼】装备此牌后，立刻使用一次【孤风刀势】。；装备有此牌的【魔偶剑鬼】施放【孤风刀势】后，我方切换到后一个角色；施放【霜驰影突】后，我方切换到前一个角色。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/29356bd9bc7cbd8bf4843d6725cb8af6_6954582480310016602.png',
        3, 5, 0, [6, 7], 1781, 1, talentSkill(1), { expl: [...talentExplain(1781, 1), newSummonee(3020)] }),

    725: new GICard(725, '重铸：岩盔', '[战斗行动]：我方出战角色为【丘丘岩盔王】时，装备此牌。；【丘丘岩盔王】装备此牌后，立刻使用一次【Upa Shato】。；装备有此牌的【丘丘岩盔王】击倒地方角色后：【丘丘岩盔王】重新附属【岩盔】和【坚岩之力】。',
        'https://patchwiki.biligame.com/images/ys/9/9f/ijpaagvk7o9jh1pzb933vl9l2l4islk.png',
        4, 6, 0, [6, 7], 1801, 1, (_card, event) => talentHandle(event, 2, () =>
            [() => ({}), { execmds: [{ cmd: 'getStatus', status: [heroStatus(2045), heroStatus(2046)] }] }], 'kill'), { expl: talentExplain(1801, 2), energy: 2 }),

    726: new GICard(726, '孢子增殖', '[战斗行动]：我方出战角色为【翠翎恐蕈】时，装备此牌。；【翠翎恐蕈】装备此牌后，立刻使用一次【不稳定孢子云】。；装备有此牌的【翠翎恐蕈】可累积的｢活化激能｣层数+1。',
        'https://patchwiki.biligame.com/images/ys/4/41/bj27pgk1uzd78oc9twitrw7aj1fzatb.png',
        3, 7, 0, [6, 7], 1821, 1, talentSkill(1), { expl: talentExplain(1781, 1) }),

    727: new GICard(727, '砰砰礼物', '[战斗行动]：我方出战角色为【可莉】时，装备此牌。；【可莉】装备此牌后，立刻使用一次【蹦蹦炸弹】。；装备有此牌的【可莉】生成的【爆裂火花】的[可用次数]+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/0cca153cadfef3f9ccfd37fd2b306b61_8853740768385239334.png',
        3, 2, 0, [6, 7], 1205, 1, talentSkill(1), { expl: talentExplain(1205, 1) }),

    728: new GICard(728, '落羽的裁择', '[战斗行动]：我方出战角色为【赛诺】时，装备此牌。；【赛诺】装备此牌后，立刻使用一次【秘仪·律渊渡魂】。；装备有此牌的【赛诺】在【启途誓使】的｢凭依｣级数为偶数时使用【秘仪·律渊渡魂】时，造成的伤害额外+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b4f218c914886ea4ab9ce4e0e129a8af_2603691344610696520.png',
        3, 3, 0, [6, 7], 1304, 1, talentSkill(1), { expl: [...talentExplain(1304, 1), heroStatus(2060)] }),

    729: new GICard(729, '霹雳连霄', '[战斗行动]：我方出战角色为【北斗】时，装备此牌。；【北斗】装备此牌后，立刻使用一次【捉浪】。；装备有此牌的【北斗】使用【踏潮】时：使【北斗】本回合内｢普通攻击｣少花费1个[无色元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/c3004d7c3873556c01124277c58b4b87_6946169426849615589.png',
        3, 3, 0, [6, 7], 1305, 1, talentSkill(1), { expl: talentExplain(1305, 1) }),

    730: new GICard(730, '我界', '[战斗行动]：我方出战角色为【九条裟罗】时，装备此牌。；【九条裟罗】装备此牌后，立刻使用一次【鸦羽天狗霆雷召咒】。；装备有此牌的【九条裟罗】在场时，我方附属有【鸣煌护持】的‹3雷元素›角色，｢元素战技｣和｢元素爆发｣造成的伤害额外+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/3eb3cbf6779afc39d7812e5dd6e504d9_148906889400555580.png',
        3, 3, 0, [6, 7], 1306, 1, (_card, event) => talentHandle(event, 1, () => {
            const { heros = [] } = event;
            const hero = heros.find(h => h.isFront);
            if (!hero) throw new Error('hero not found: heros=' + heros);
            const isAdd = hero.element == 3 && hero.inStatus.some(ist => ist.id == 2064);
            return [() => ({}), { addDmgCdt: isCdt(isAdd, 1) }]
        }, ['skilltype2', 'skilltype3', 'other-skilltype2', 'other-skilltype3']), { expl: talentExplain(1306, 1) }),

    731: new GICard(731, '匣中玉栉', '[战斗行动]：我方出战角色为【珊瑚宫心海】时，装备此牌。；【珊瑚宫心海】装备此牌后，立刻使用一次【海人化羽】。；装备有此牌的【珊瑚宫心海】使用【海人化羽】时：召唤一个[可用次数]为1的【化海月】; 如果【化海月】已在场，则改为使其[可用次数]+1。；【仪来羽衣】存在期间，【化海月】造成的伤害+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/5e980c377a2142322435bb4487b4f8fc_5354100201913685764.png',
        3, 1, 0, [6, 7], 1104, 1, talentSkill(2), { expl: talentExplain(1104, 2), energy: 2 }),

    732: new GICard(732, '战欲涌现', '[战斗行动]：我方出战角色为【优菈】时，装备此牌。；【优菈】装备此牌后，立刻使用一次【凝浪之光剑】。；装备有此牌的【优菈】使用【冰潮的涡旋】时，会额外为【光降之剑】累积1点｢能量层数｣。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/54bfba5d0eb40f38a0b679808dbf3941_5181344457570733816.png',
        3, 4, 0, [6, 7], 1006, 1, talentSkill(2), { expl: talentExplain(1006, 2), energy: 2 }),

    733: new GICard(733, '镜华风姿', '[战斗行动]：我方出战角色为【神里绫人】时，装备此牌。；【神里绫人】装备此牌后，立刻使用一次【神里流·镜花】。；装备有此牌的【神里绫人】触发【泷廻鉴花】的效果时，对于生命值不多于6的敌人伤害+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/a222141c6f996c368c642afe39572e9f_2099787104835776248.png',
        3, 1, 0, [6, 7], 1105, 1, (_card, event) => talentHandle(event, 1, () => {
            const { eheros = [], heros = [], hidxs = [] } = event;
            const isAdd = (eheros.find(h => h.isFront)?.hp ?? 10) <= 6 && heros[hidxs[0]].inStatus.some(ist => ist.id == 2067);
            return [() => ({}), { addDmgCdt: isCdt(isAdd, 1) }]
        }, 'skilltype1'), { expl: talentExplain(1105, 1) }),

    734: new GICard(734, '荒泷第一', '[战斗行动]：我方出战角色为【荒泷一斗】时，装备此牌。；【荒泷一斗】装备此牌后，立刻使用一次【喧哗屋传说】。；装备有此牌的【荒泷一斗】每回合第2次及以后使用【喧哗屋传说】时：如果触发【乱神之怪力】，伤害额外+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/46588f6b5a254be9e797cc0cfe050dc7_8733062928845037185.png',
        1, 6, 0, [6, 7], 1503, 1, (_card, event) => talentHandle(event, 0, () => {
            const { heros = [], hidxs = [], isChargedAtk = false } = event;
            const { inStatus, skills: [{ useCnt }] } = heros[hidxs[0]];
            return [() => ({}), { addDmgCdt: isCdt(isChargedAtk && useCnt >= 1 && inStatus.some(ist => ist.id == 2068), 1) }]
        }, 'skilltype1'), { expl: talentExplain(1503, 0), anydice: 2 }),

    735: new GICard(735, '眼识殊明', '[战斗行动]：我方出战角色为【提纳里】时，装备此牌。；【提纳里】装备此牌后，立刻使用一次【识果种雷】。；装备有此牌的【提纳里】在附属【通塞识】期间，进行[重击]时少花费1个[无色元素骰]。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e949b69145f320ae71ce466813339573_5047924760236436750.png',
        4, 7, 0, [6, 7], 1602, 1, (_card, event) => talentHandle(event, 1, () => {
            const { isChargedAtk = false, heros = [], hidxs = [] } = event;
            const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] },
                () => isChargedAtk && heros[hidxs[0]].inStatus.some(ist => ist.id == 2071));
            return [() => ({}), { ...minusSkillRes }]
        }, ''), { expl: talentExplain(1602, 1) }),

    736: new GICard(736, '忘玄', '[战斗行动]：我方出战角色为【申鹤】时，装备此牌。；【申鹤】装备此牌后，立刻使用一次【仰灵威召将役咒】。；装备有此牌的【申鹤】生成的【冰翎】被我方角色的｢普通攻击｣触发时：不消耗[可用次数]。(每回合1次)。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/9df7f8bf2b97688d9a8fae220b4ff799_2381296963104605530.png',
        3, 4, 0, [6, 7], 1007, 1, talentSkill(1), { expl: talentExplain(1007, 1) }),

    737: new GICard(737, '深渊之灾·凝水盛放', '[战斗行动]：我方出战角色为【达达利亚】时，装备此牌。；【达达利亚】装备此牌后，立刻使用一次【魔王武装·狂澜】。；结束阶段：装备有此牌的【达达利亚】在场时，敌方出战角色附属有【断流】，则对其造成1点[穿透伤害]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e56754de22dbaf1cfb84ce85af588d21_7106803920286784988.png',
        3, 1, 0, [6, 7], 1106, 1, talentSkill(1), { expl: talentExplain(1106, 1) }),

    738: new GICard(738, '一触即发', '[战斗行动]：我方出战角色为【安柏】时，装备此牌。；【安柏】装备此牌后，立刻使用一次【爆炸玩偶】。；【安柏｢普通攻击｣后：】如果此牌和【兔兔伯爵】仍在场，则引爆【兔兔伯爵】，造成4点[火元素伤害]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2a48f2862634d319b9165838de944561_3946596064567874908.png',
        3, 2, 0, [6, 7], 1206, 1, talentSkill(1), { expl: talentExplain(1206, 1) }),

    739: new GICard(739, '血之灶火', '[战斗行动]：我方出战角色为【胡桃】时，装备此牌。；【胡桃】装备此牌后，立刻使用一次【蝶引来生】。；装备有此牌的【胡桃】在生命值不多于6时，造成的[火元素伤害]+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/950a1fe6fcb977429942fcf0db1a6cc6_4713651560561730973.png',
        2, 2, 0, [6, 7], 1207, 1, (_card, event) => talentHandle(event, 1, () => {
            const { heros = [] } = event;
            const isTalent = (heros.find(h => h.id == 1207)?.hp ?? 10) <= 6;
            return [() => ({}), { addDmgCdt: isCdt(isTalent, 1) }]
        }, 'fire-dmg'), { expl: talentExplain(1207, 1) }),

    740: new GICard(740, '万千的愿望', '[战斗行动]：我方出战角色为【雷电将军】时，装备此牌。；【雷电将军】装备此牌后，立刻使用一次【奥义·梦想真说】。；装备有此牌的【雷电将军】使用【奥义·梦想真说】时每消耗1点｢愿力｣，都使造成的伤害额外+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bea2df42c6cb8eecf724f2da60554278_2483208280861354828.png',
        4, 3, 0, [6, 7], 1307, 1, talentSkill(2), { expl: talentExplain(1307, 2), energy: 2 }),

    741: new GICard(741, '神篱之御荫', '[战斗行动]：我方出战角色为【八重神子】时，装备此牌。；【八重神子】装备此牌后，立刻使用一次【大密法·天狐显真】。；装备有此牌的【八重神子】通过【大密法·天狐显真】消灭了【杀生樱】后，本回合下次使用【野千役咒·杀生樱】时少花费2个元素骰。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bdb47c41b068190b9f0fd7fe1ca46bf3_449350753177106926.png',
        3, 3, 0, [6, 7], 1308, 1, talentSkill(2), { expl: talentExplain(1308, 2), energy: 2 }),

    742: new GICard(742, '绪风之拥', '[战斗行动]：我方出战角色为【温迪】时，装备此牌。；【温迪】装备此牌后，立刻使用一次【高天之歌】。；装备有此牌的【温迪】生成的【风域】触发后，会使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f46cfa06d1b3ebe29fe8ed2c986b4586_6729812664471389603.png',
        3, 5, 0, [6, 7], 1403, 1, talentSkill(1), { expl: talentExplain(1403, 1) }),

    743: new GICard(743, '降魔·护法夜叉', '[战斗行动]：我方出战角色为【魈】时，装备此牌。；【魈】装备此牌后，立刻使用一次【靖妖傩舞】。；装备有此牌的【魈】附属【夜叉傩面】期间，使用【风轮两立】时少花费1个[风元素骰]。(每附属1次【夜叉傩面】，可触发2次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fae27eb5db055cf623a80c11e08bb07c_2875856165408881126.png',
        3, 5, 0, [6, 7], 1404, 1, talentSkill(2), { expl: talentExplain(1404, 2), energy: 2 }),

    744: new GICard(744, '炊金馔玉', '[战斗行动]：我方出战角色为【钟离】时，装备此牌。；【钟离】装备此牌后，立刻使用一次【地心·磐礴】。；装备有此牌的【钟离】在场时，我方出战角色在[护盾]角色状态或[护盾]出战状态的保护下时，我方召唤物造成的[岩元素伤害]+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/05/24/255120502/1742e240e25035ec13155e7975f7fe3e_495500543253279445.png',
        5, 6, 0, [6, 7], 1504, 1, (_card, event) => talentHandle(event, 2, () => {
            const { heros = [], hidxs = [] } = event;
            const istShield = heros[hidxs[0]]?.inStatus.some(ist => ist.type.includes(7));
            const ostShield = heros.find(h => h.isFront)?.outStatus.some(ost => ost.type.includes(7));
            return [() => ({}), { addDmgSummon: isCdt(istShield || ostShield, 1) }]
        }, 'rock-dmg'), { expl: talentExplain(1504, 2) }),

    745: new GICard(745, '心识蕴藏之种', '[战斗行动]：我方出战角色为【纳西妲】时，装备此牌。；【纳西妲】装备此牌后，立刻使用一次【心景幻成】。；装备有此牌的【纳西妲】在场时，根据我方队伍中存在的元素类型提供效果：；‹2火元素›：【摩耶之殿】在场时，自身受到元素反应触发【蕴种印】的敌方角色，所受【蕴种印】的[穿透伤害]改为[草元素伤害];；‹3雷元素›：【摩耶之殿】入场时，使当前对方场上【蕴种印】的[可用次数]+1;；‹1水元素›：装备有此牌的【纳西妲】所生成的【摩耶之殿】初始持续回合+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/013c862d1c89850fb23f26763f601b11_823565145951775374.png',
        3, 7, 0, [6, 7], 1603, 1, talentSkill(3), { expl: talentExplain(1603, 3), energy: 2 }),

    746: new GICard(746, '冰萤寒光', '[战斗行动]：我方出战角色为【愚人众·冰萤术士】时，装备此牌。；【愚人众·冰萤术士】装备此牌后，立刻使用一次【虚雾摇唤】。；装备有此牌的【愚人众·冰萤术士】使用技能后：如果【冰萤】的[可用次数]被叠加到超过上限，则造成2点[冰元素伤害]。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6d2ef9ea6bacdc1b48a5253345986cd_7285265484367498835.png',
        3, 4, 0, [6, 7], 1701, 1, talentSkill(1), { expl: talentExplain(1701, 1) }),

    747: new GICard(747, '汲能棱晶', '[战斗行动]：我方出战角色为【无相之雷】时，治疗该角色3点，并附属【雷晶核心】。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3257a4da5f15922e8f068e49f5107130_6618336041939702810.png',
        2, 3, 2, [6, 7], 1761, 1, () => ({
            inStatus: [heroStatus(2091)],
            heal: 3,
            cmds: [{ cmd: 'heal', cnt: 3 }]
        }), { expl: talentExplain(1761, 3) }),

    748: new GICard(748, '烬火重燃', '【入场时：】如果装备有此牌的【深渊咏者·渊火】已触发过【火之新生】，就立刻弃置此牌，为角色附属【渊火加护】。；装备有此牌的【深渊咏者·渊火】触发【火之新生】时：弃置此牌，为角色附属【渊火加护】。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/c065153c09a84ed9d7c358c8cc61171f_8734243408282507546.png',
        2, 2, 0, [6], 1742, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isTriggered = heros[hidxs[0]]?.inStatus.every(ist => ist.id != 2092);
            return {
                inStatus: isCdt(isTriggered, [heroStatus(2093)]),
                isDestroy: isTriggered,
            }
        }, { expl: [heroStatus(2093)] }),

    749: new GICard(749, '衍溢的汐潮', '[战斗行动]：我方出战角色为【坎蒂丝】时，装备此牌。；【坎蒂丝】装备此牌后，立刻使用一次【圣仪·灰鸰衒潮】。；装备有此牌的【坎蒂丝】生成的【赤冕祝祷】额外具有以下效果：我方角色｢普通攻击｣后：造成1点[水元素伤害]。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/64b78d95471e27f99a8cf1cf2a946537_1864982310212941599.png',
        3, 1, 0, [6, 7], 1107, 1, talentSkill(2), { expl: talentExplain(1107, 2), energy: 2 }),

    750: new GICard(750, '最终解释权', '[战斗行动]：我方出战角色为【烟绯】时，装备此牌。；【烟绯】装备此牌后，立刻使用一次【火漆印制】。；装备有此牌的【烟绯】进行[重击]时：对生命值不多于6的敌人造成的伤害+1。；如果触发了【丹火印】，则在技能结算后摸1张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ad8a2130c54da3c3f25d094b7019cb69_4536540887547691720.png',
        1, 2, 0, [6, 7], 1208, 1, (_card, event) => talentHandle(event, 0, () => {
            const { isChargedAtk = false, heros = [], hidxs = [], eheros = [] } = event;
            return [() => ({}), {
                addDmgCdt: isCdt(isChargedAtk && (eheros.find(h => h.isFront)?.hp ?? 10) <= 6, 1),
                execmds: isCdt(isChargedAtk && heros[hidxs[0]].inStatus.some(ist => ist.id == 2096), [{ cmd: 'getCard', cnt: 1 }])
            }]
        }, 'skilltype1'), { expl: talentExplain(1208, 0), anydice: 2 }),

    751: new GICard(751, '风物之诗咏', '[战斗行动]：我方出战角色为【枫原万叶】时，装备此牌。；【枫原万叶】装备此牌后，立刻使用一次【千早振】。；装备有此牌的【枫原万叶】引发扩散反应后：使我方角色和召唤物接下来2次所造成的的被扩散元素类型的伤害+1。(每种元素类型分别计算次数)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/dd06fa7b0ec63f3e60534a634ebd6fd2_9125107885461849882.png',
        3, 5, 0, [6, 7], 1405, 1, (_card, event) => talentHandle(event, 1, () => {
            const { trigger = '' } = event;
            const windEl = trigger.startsWith('el5Reaction') ? Number(trigger.slice(trigger.indexOf(':') + 1)) : 5;
            return [() => ({}), { outStatus: isCdt(windEl < 5, [heroStatus(2118 + windEl)]) }]
        }, 'el5Reaction'), { expl: talentExplain(1405, 1) }),

    752: new GICard(752, '脉冲的魔女', '切换到装备有此牌的【丽莎】后：使敌方出战角色附属【引雷】。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/608b48c391745b8cbae976d971b8b8c0_2956537094434701939.png',
        1, 3, 0, [6], 1309, 1, (card, event) => {
            const { heros = [], hidxs = [], eheros = [] } = event;
            return {
                trigger: isCdt(card.perCnt > 0, ['change-to']),
                exec: () => {
                    --card.perCnt;
                    return { inStatusOppo: [heroStatus(2099, [heros[hidxs[0]].skills[1]])], hidxs: [eheros.findIndex(h => h.isFront)] }
                },
            }
        }, { pct: 1, expl: [heroStatus(2099)] }),

    753: new GICard(753, '起死回骸', '[战斗行动]：我方出战角色为【七七】时，装备此牌。；【七七】装备此牌后，立刻使用一次【仙法·救苦度厄】。；装备有此牌的【七七】使用【仙法·救苦度厄】时，复苏我方所有倒下角色，并治疗其2点。(整场牌局限制2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/258999284/d5ef496771a846af08ec05fff036bf17_8628795343837772161.png',
        5, 4, 0, [6, 7], 1008, 1, talentSkill(2), { pct: 2, expl: talentExplain(1008, 2), energy: 3 }),

    754: new GICard(754, '神性之陨', '[战斗行动]：我方出战角色为【阿贝多】时，装备此牌。；【阿贝多】装备此牌后，立刻使用一次【创生法·拟造阳华】。；装备有此牌的【阿贝多】在场时，如果我方场上存在【阳华】，则我方角色进行[下落攻击]时造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/82503813/d10a709aa03d497521636f9ef39ee531_3239361065263302475.png',
        3, 6, 0, [6, 7], 1505, 1, (_card, event) => talentHandle(event, 1, () => {
            const { summons = [], isFallAtk = false } = event;
            return [() => ({}), { addDmgCdt: isCdt(summons.some(smn => smn.id == 3040) && isFallAtk, 1) }]
        }, ['skilltype1', 'other-skilltype1']), { expl: talentExplain(1505, 1) }),

    755: new GICard(755, '梦迹一风', '[战斗行动]：我方出战角色为【流浪者】时，装备此牌。；【流浪者】装备此牌后，立刻使用一次【羽画·风姿华歌】。；装备有此牌的【流浪者】在【优风倾姿】状态下进行[重击]后：下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/08a42903fcff2a5249ef1fc4021ecf7a_492792879105973370.png',
        4, 5, 0, [6, 7], 1406, 1, (_card, event) => talentHandle(event, 1, () => {
            const { isChargedAtk = false, heros = [], hidxs = [] } = event;
            const hasSts2102 = heros[hidxs[0]].inStatus.some(ist => ist.id == 2102);
            return [() => ({}), { execmds: isCdt(isChargedAtk && hasSts2102, [{ cmd: 'getStatus', status: [heroStatus(2103)] }]) }]
        }, 'skilltype1'), { expl: talentExplain(1406, 1) }),

    756: new GICard(756, '崇诚之真', '[战斗行动]：我方出战角色为【迪希雅】时，装备此牌。；【迪希雅】装备此牌后，立刻使用一次【熔铁流狱】。；【结束阶段：】如果装备有此牌的【迪希雅】生命值不多于6，则治疗该角色2点。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/161a55bb8e3e5141557f38536579e897_3725263134237782114.png',
        4, 2, 0, [6, 7], 1209, 1, (_card, event) => talentHandle(event, 1, () => {
            const { heros = [], hidxs = [] } = event;
            return [() => ({}), { execmds: isCdt<Cmds[]>((heros[hidxs[0]]?.hp ?? 10) <= 6, [{ cmd: 'heal', cnt: 2, hidxs }]) }]
        }, 'phase-end'), { expl: talentExplain(1209, 1) }),

    757: new GICard(757, '慈惠仁心', '[战斗行动]：我方出战角色为【瑶瑶】时，装备此牌。；【瑶瑶】装备此牌后，立刻使用一次【云台团团降芦菔】。；装备有此牌的【瑶瑶】生成的【月桂·抛掷型】，在[可用次数]仅剩余最后1次时造成的伤害和治疗各+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/2b762e3829ac4a902190fde3e0f5377e_8510806015272134296.png',
        3, 7, 0, [6, 7], 1604, 1, talentSkill(1), { expl: talentExplain(1604, 1) }),

    758: new GICard(758, '星天的花雨', '[战斗行动]：我方出战角色为【妮露】时，装备此牌。；【妮露】装备此牌后，立刻使用一次【七域舞步】。；装备有此牌的【妮露】在场时：我方【丰穰之核】造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/8cc9e5054277fa7e344648ac99671e7d_2129982885233274884.png',
        3, 1, 0, [6, 7], 1108, 1, talentSkill(1), { expl: talentExplain(1108, 1) }),

    759: new GICard(759, '酌盈剂虚', '[战斗行动]：我方出战角色为【多莉】时，装备此牌。；【多莉】装备此牌后，立刻使用一次【卡萨扎莱宫的无微不至】。；装备有此牌的【多莉】所召唤的【灯中幽精】，对生命值不多于6的角色造成的治疗+1，使没有[充能]的角色获得[充能]时获得量+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/da73eb59f8fbd54b1c3da24d494108f7_706910708906017594.png',
        3, 3, 0, [6, 7], 1310, 1, talentSkill(2), { expl: talentExplain(1310, 2), energy: 2 }),

    760: new GICard(760, '在地为化', '[战斗行动]：我方出战角色为【白术】时，装备此牌。；【白术】装备此牌后，立刻使用一次【愈气全形论】。；装备有此牌的【白术】在场，[无欲气护盾]触发治疗效果时：生成1个出战角色类型的元素骰。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/aa3ad0a53cd667f9d6e5393214dfa09d_9069092032307263917.png',
        4, 7, 0, [6, 7], 1605, 1, talentSkill(2), { expl: talentExplain(1605, 2), energy: 2 }),

    761: new GICard(761, '归芒携信', '[战斗行动]：我方出战角色为【莱依拉】时，装备此牌。；【莱依拉】装备此牌后，立刻使用一次【垂裳端凝之夜】。；装备有此牌的【莱依拉】在场时，每当【飞星】造成伤害，就摸1张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/bf34b0aa7f7664582ddb7eacaf1bd9ca_8982816839843813094.png',
        3, 4, 0, [6, 7], 1009, 1, talentSkill(1), { expl: talentExplain(1009, 1) }),

    762: new GICard(762, '猜先有方', '[战斗行动]：我方出战角色为【夜兰】时，装备此牌。；【夜兰】装备此牌后，立刻使用一次【萦络纵命索】。；【投掷阶段：】装备有此牌的【夜兰】在场，则我方队伍中每有1种元素类型，就使1个元素骰总是投出[万能元素骰]。(最多3个)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/09/258999284/3914bb6ef21abc1f7e373cfe38d8be27_3734095446197720091.png',
        3, 1, 0, [6, 7], 1109, 1, (_card, event) => talentHandle(event, 1, () => {
            const { heros = [] } = event;
            return [() => ({}), { element: 0, cnt: Math.min(3, new Set(heros.map(h => h.element)).size) }]
        }, 'phase-dice'), { expl: talentExplain(1109, 1) }),

    763: new GICard(763, '完场喝彩', '[战斗行动]：我方出战角色为【林尼】时，装备此牌。；【林尼】装备此牌后，立刻使用一次【隐具魔术箭】。；装备有此牌的【林尼】在场时，【林尼】自身和【怪笑猫猫帽】对具有‹2火元素附着›的角色造成的伤害+2。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/be471c09e294aaf12766ee17b624ddcc_5013564012859422460.png',
        3, 2, 0, [6, 7], 1210, 1, (card, event) => talentHandle(event, 1, () => {
            const { heros = [], eheros = [], hidxs = [] } = event;
            const isAttachEl2 = eheros.find(h => h.isFront)?.attachElement.includes(2);
            return [() => {
                --card.perCnt;
            }, { addDmgCdt: isCdt(card.perCnt > 0 && heros[hidxs[0]].isFront && isAttachEl2, 2) }]
        }, ['skill']), { pct: 1, expl: talentExplain(1210, 1) }),

    764: new GICard(764, '如影流露的冷刃', '[战斗行动]：我方出战角色为【琳妮特】时，装备此牌。；【琳妮特】装备此牌后，立刻使用一次【谜影障身法】。；装备有此牌的【琳妮特】每回合第二次使用【谜影障身法】时：伤害+2，并强制敌方切换到前一个角色。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/09214e6eaeb5399f4f1dd78e7a9fcf66_5441065129648025265.png',
        3, 5, 0, [6, 7], 1407, 1, talentSkill(1), { expl: talentExplain(1407, 1) }),

    765: new GICard(765, '犬奔·疾如风', '[战斗行动]：我方出战角色为【五郎】时，装备此牌。；【五郎】装备此牌后，立刻使用一次【犬坂吠吠方圆阵】。；装备有此牌的【五郎】在场时，我方角色造成[岩元素伤害]后：如果场上存在【大将旗指物】，摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5355a3c8d887fd0cc8fe8301c80d48ba_7375558397858714678.png',
        3, 6, 0, [6, 7], 1506, 1, (card, event) => talentHandle(event, 1, () => {
            const { heros = [], isSkill = -1 } = event;
            const isUse = isSkill > -1 && heros.find(h => h.isFront)?.outStatus.some(ost => ost.id == 2135) && card.perCnt > 0;
            if (!isUse) return [() => ({})]
            return [() => {
                --card.perCnt;
                return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
            }]
        }, ['rock-dmg']), { pct: 1, expl: talentExplain(1506, 1) }),

    766: new GICard(766, '正理', '[战斗行动]：我方出战角色为【艾尔海森】时，装备此牌。；【艾尔海森】装备此牌后，立刻使用一次【殊境·显象缚结】。；装备有此牌的【艾尔海森】使用【殊境·显象缚结】时，如果消耗了持续回合至少为1的【琢光镜】，则总是附属持续回合为3的【琢光镜】，并且摸1张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/1ea58f5478681a7975c0b79906df7e07_2030819403219420224.png',
        3, 7, 0, [6, 7], 1606, 1, talentSkill(2), { expl: talentExplain(1606, 2), energy: 2 }),

    767: new GICard(767, '苦痛奉还', '我方出战角色为「女士」时，才能打出：入场时，生成3个「女士」当前元素类型的元素骰。；角色受到至少为3点的伤害时：抵消1点伤害，然后根据「女士」的形态对敌方出战角色附属【严寒】或【炽热】。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/b053865b60ec217331ea86ff7fb8789c_3260337021267875040.png',
        3, 8, 0, [-1, 6], 1702, 1, (card, event) => {
            const { heros = [], hidxs = [], restDmg = -1 } = event;
            if (hidxs.length == 0) return;
            const hero = heros[hidxs[0]];
            if (restDmg > -1) {
                if (restDmg < 3 || card.perCnt == 0) return { restDmg }
                --card.perCnt;
                return {
                    restDmg: restDmg - 1,
                    inStatusOppo: [heroStatus(2137, hero.element == 4 ? 0 : 1)],
                    cmds: [{ cmd: '' }],
                }
            }
            return { isValid: hero?.isFront, cmds: [{ cmd: 'getDice', cnt: 3, element: hero.element }] }
        }, { pct: 1, expl: [heroStatus(2137), heroStatus(2137, 1)] }),

    768: new GICard(768, '魔蝎烈祸', '[战斗行动]：我方出战角色为【镀金旅团·炽沙叙事人】时，装备此牌。；【镀金旅团·炽沙叙事人】装备此牌后，立刻使用一次【厄灵苏醒·炎之魔蝎】。；装备有此牌的【镀金旅团·炽沙叙事人】生成的【厄灵·炎之魔蝎】在【镀金旅团·炽沙叙事人】使用过｢普通攻击｣或｢元素战技｣的回合中，造成的伤害+1。；【厄灵·炎之魔蝎】的减伤效果改为每回合至多2次。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/031bfa06becb52b34954ea500aabc799_7419173290621234199.png',
        3, 2, 0, [6, 7], 1743, 1, talentSkill(2), { expl: talentExplain(1743, 2), energy: 2 }),

    769: new GICard(769, '悲号回唱', '[战斗行动]：我方出战角色为【雷音权现】时，装备此牌。；【雷音权现】装备此牌后，立刻使用一次【雷墙倾轧】。；装备有此牌的【雷音权现】在场，附属有【雷鸣探知】的敌方角色受到伤害时：我方摸1张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/2dd249ed58e8390841360d901bb0908d_4304004857878819810.png',
        3, 3, 0, [6, 7], 1762, 1, talentSkill(1), { pct: 1, expl: talentExplain(1762, 1) }),

    770: new GICard(770, '毁裂风涡', '[战斗行动]：我方出战角色为【特瓦林】时，装备此牌。；【特瓦林】装备此牌后，立刻使用一次【暴风轰击】。；装备有此牌的【特瓦林】在场时，敌方出战角色所附属的【坍毁】状态被移除后：对下一个敌方后台角色附属【坍毁】。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/2832d884a3a931ecf486c2259908f41b_7125699530621449061.png',
        3, 5, 0, [6, 7], 1782, 1, talentSkill(1), { pct: 1, expl: talentExplain(1782, 1) }),

    771: new GICard(771, '晦朔千引', '[战斗行动]：我方出战角色为【若陀龙王】时，对该角色打出。使若陀龙王附属【磐岩百相·元素凝晶】，然后生成每种我方角色所具有的元素类型的元素骰各1个。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5fd09f6cb9ecdc308105a2965989fdec_6866194267097059630.png',
        2, 8, 2, [6, 7], 1802, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const element = [...new Set(heros.map(h => h.element))];
            return { inStatus: [heroStatus(2145, heros[hidxs[0]].skills[1].src)], cmds: [{ cmd: 'getDice', cnt: heros.length, element }] }
        }, { expl: [heroStatus(2145)] }),

    772: new GICard(772, '僚佐的才巧', '[战斗行动]：我方出战角色为【托马】时，装备此牌。；【托马】装备此牌后，立刻使用一次【真红炽火之大铠】。；装备有此牌的【托马】生成的【炽火大铠】，初始[可用次数]+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/d1ba5d6f1a7bdb24e95ca829357df03a_6674733466390586160.png',
        3, 2, 0, [6, 7], 1211, 1, talentSkill(2), { expl: talentExplain(1211, 2), energy: 2 }),

    773: new GICard(773, '偷懒的新方法', '[战斗行动]：我方出战角色为【早柚】时，装备此牌。；【早柚】装备此牌后，立刻使用一次【呜呼流·风隐急进】。；装备有此牌的【早柚】为出战角色期间，我方引发扩散反应时：摸2张牌。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8399149d2618f3566580df22b153579a_4849308244790424730.png',
        3, 5, 0, [6, 7], 1408, 1, (card, event) => talentHandle(event, 1, () => {
            const { heros = [], hidxs = [] } = event;
            const isUse = heros[hidxs[0]]?.isFront && card.perCnt > 0;
            return [() => {
                if (isUse) --card.perCnt;
            }, { execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getCard', cnt: 2 }]) }]
        }, ['el5Reaction']), { pct: 1, expl: talentExplain(1408, 2) }),

    774: new GICard(774, '严霜棱晶', '我方出战角色为【无相之冰】时，才能打出：使其附属【冰晶核心】。；装备有此牌的【无相之冰】触发【冰晶核心】后：对敌方出战角色附属【严寒】。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/71d1da569b1927b33c9cd1dcf04c7ab1_880598011600009874.png',
        1, 4, 0, [6], 1703, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            return { isValid: heros[hidxs[0]]?.isFront, inStatus: [heroStatus(2157)] }
        }, { expl: [...talentExplain(1703, 3), heroStatus(2137)] }),

    775: new GICard(775, '明珠固化', '我方出战角色为【千年珍珠骏麟】时，才能打出：入场时，使【千年珍珠骏麟】附属[可用次数]为1的【原海明珠】; 如果已附属【原海明珠】，则使其[可用次数]+1。；装备有此牌的【千年珍珠骏麟】所附属的【原海明珠】抵消召唤物造成的伤害时，改为每回合2次不消耗[可用次数]。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/ec966272143de66e191950a6016cf14f_3693512171806066057.png',
        0, 8, 0, [6], 1763, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const hero = heros[hidxs[0]];
            const cnt = (hero.inStatus.find(ist => ist.id == 2158)?.useCnt ?? 0) + 1;
            return { isValid: hero?.isFront, inStatus: [heroStatus(2158, true, cnt, 1)] }
        }, { expl: [heroStatus(2158)] }),

    776: new GICard(776, '以有趣相关为要义', '[战斗行动]：我方出战角色为【夏洛蒂】时，装备此牌。；【夏洛蒂】装备此牌后，立刻使用一次【取景·冰点构图法】。；装备有此牌的【夏洛蒂】在场时，我方角色进行｢普通攻击｣后：如果对方场上附属有【瞬时剪影】，则治疗我方出战角色2点。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/29c5370c3846c6c0a5722ef1f6c94d97_1023653312046109359.png',
        3, 4, 0, [6, 7], 1010, 1, (card, event) => talentHandle(event, 1, () => {
            const { eheros = [] } = event;
            const isUse = card.perCnt > 0 && eheros.flatMap(h => h.inStatus).some(ist => ist.id == 2163);
            return [() => {
                if (isUse) --card.perCnt;
            }, { execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'heal', cnt: 2 }]) }]
        }, ['skilltype1', 'other-skilltype1']), { pct: 1, expl: talentExplain(1010, 1) }),

    777: new GICard(777, '古海孑遗的权柄', '[战斗行动]：我方出战角色为【那维莱特】时，装备此牌。；【那维莱特】装备此牌后，立刻使用一次【如水从平】。；我方角色引发[水元素相关反应]后：装备有此牌的【那维莱特】接下来2次造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d419604605c1acde00b841ecf8c82864_58733338663118408.png',
        1, 1, 0, [6, 7], 1110, 1, (_card, event) => talentHandle(event, 0, () => {
            const { isSkill = -1, hidxs = [] } = event;
            return [() => ({}), { inStatus: isCdt(isSkill > -1, [heroStatus(2166)]), hidxs }]
        }, ['el1Reaction', 'other-el1Reaction']), { expl: talentExplain(1110, 0), anydice: 2 }),

    778: new GICard(778, '沿途百景会心', '[战斗行动]：我方出战角色为【绮良良】时，装备此牌。；【绮良良】装备此牌后，立刻使用一次【呜喵町飞足】。；装备有此牌的【绮良良】为出战角色，我方进行｢切换角色｣行动时：少花费1个元素骰。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d00693f2246c912c56900d481e37104a_1436874897141676884.png',
        3, 7, 0, [6, 7], 1607, 1, (card, event) => talentHandle(event, 1, () => {
            let { changeHeroDiceCnt = 0 } = event;
            const isMinus = card.perCnt > 0;
            return [() => {
                if (changeHeroDiceCnt > 0 && isMinus) {
                    --card.perCnt;
                    --changeHeroDiceCnt;
                }
                return { changeHeroDiceCnt }
            }, { minusDiceHero: isCdt(isMinus, 1) }]
        }, 'change-from'), { pct: 1, expl: talentExplain(1607, 1) }),

    779: new GICard(779, '雷萤浮闪', '[战斗行动]：我方出战角色为【愚人众·雷萤术士】时，装备此牌。；【愚人众·雷萤术士】装备此牌后，立刻使用一次【雾虚之召】。；装备有此牌的【愚人众·雷萤术士】在场时，我方选择行动前：如果【雷萤】的[可用次数]至少为3，则【雷萤】立刻造成1点[雷元素伤害]。(需消耗[可用次数]，每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/adf954bd07442eed0bc3c77847c2d727_1148348250566405252.png',
        3, 3, 0, [6, 7], 1764, 1, talentSkill(1), { pct: 1, expl: talentExplain(1764, 1) }),

    780: new GICard(780, '割舍软弱之心', '[战斗行动]：我方出战角色为【久岐忍】时，装备此牌。；【久岐忍】装备此牌后，立刻使用一次【御咏鸣神刈山祭】。；装备有此牌的【久岐忍】被击倒时：角色[免于被击倒]，并治疗该角色到1点生命值。(每回合1次)；如果装备有此牌的【久岐忍】生命值不多于5，则该角色造成的伤害+1。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/b53d6688202a139f452bda31939162f8_3511216535123780784.png',
        3, 3, 0, [6, 7, -4], 1311, 1, (card, event) => talentHandle(event, 2, () => {
            const { heros = [], hidxs = [], trigger = '', reset = false } = event;
            if (reset) {
                if (!card.subType.includes(-4)) card.subType.push(-4);
                return;
            }
            return [() => {
                if (trigger == 'will-killed') {
                    --card.perCnt;
                    card.subType.pop();
                }
            }, {
                addDmgCdt: isCdt((heros[hidxs[0]]?.hp ?? 10) <= 5, 1),
                execmds: isCdt(card.perCnt > 0 && trigger == 'will-killed', [{ cmd: 'revive', cnt: 1 }])
            }]
        }, [...((event.trigger == 'skill' ? ['skill'] : []) as Trigger[]), ...((card.perCnt > 0 ? ['will-killed'] : []) as Trigger[])]),
        { pct: 1, expl: talentExplain(1311, 2), energy: 2, spReset: true }),

    781: new GICard(781, '妙道合真', '[战斗行动]：我方出战角色为【珐露珊】时，装备此牌。；【珐露珊】装备此牌后，立刻使用一次【抟风秘道】。；装备有此牌的【珐露珊】所召唤的【赫耀多方面体】入场时和行动阶段开始时：生成1个[风元素骰]。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/6f4712bcbbe53515e63c1de112a58967_7457105821554314257.png',
        3, 5, 0, [6, 7], 1409, 1, talentSkill(2), { expl: talentExplain(1409, 2), energy: 2 }),

    782: new GICard(782, '暗流涌动', '【入场时：】如果装备有此牌的【深渊使徒·激流】已触发过【水之新生】，则在对方场上生成【暗流的诅咒】。；装备有此牌的【深渊使徒·激流】被击倒或触发【水之新生】时：在对方场上生成【暗流的诅咒】。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/1dc62c9d9244cd9d63b6f01253ca9533_7942036787353741713.png',
        1, 1, 0, [6], 1723, 1, (_card, event) => {
            const { heros = [], hidxs = [] } = event;
            const isTriggered = heros[hidxs[0]]?.inStatus.every(ist => ist.id != 2181);
            return {
                outStatusOppo: isCdt(isTriggered, [heroStatus(2180)]),
                trigger: ['will-killed'],
                execmds: [{ cmd: 'getStatus', status: [heroStatus(2180)], isOppo: true }],
            }
        }, { expl: [heroStatus(2181)] }),

    783: new GICard(783, '熔火铁甲', '【入场时：】对装备有此牌的【铁甲熔火帝皇】[附着火元素]。；我方除【重甲蟹壳】以外的[护盾]状态或[护盾]出战状态被移除后：装备有此牌的【铁甲熔火帝皇】附属2层【重甲蟹壳】。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/c6d40de0f6da94fb8a8ddeccc458e5f0_8856536643600313687.png',
        1, 2, 0, [6], 1744, 1, (_card, event) => {
            const { hidxs = [] } = event;
            return { cmds: [{ cmd: 'attach', hidxs, element: 2 }] }
        }, { expl: [heroStatus(2182)], pct: 1 }),

    784: new GICard(784, '予行恶者以惩惧', '[战斗行动]：我方出战角色为【莱欧斯利】时，装备此牌。；【莱欧斯利】装备此牌后，立刻使用一次【迅烈倾霜拳】。；装备有此牌的【莱欧斯利】受到伤害或治疗后，此牌累积1点｢惩戒计数｣。；装备有此牌的【莱欧斯利】使用技能时：如果已有3点｢惩戒计数｣，则消耗3点使此技能伤害+1。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Wriothesley.webp',
        1, 4, 0, [6, 7], 1011, 1, (card, event) => talentHandle(event, 0, () => {
            const { hidxs = [], heal = [], trigger = '' } = event;
            return [() => {
                if (trigger == 'getdmg' || trigger == 'heal' && heal[hidxs[0]] > 0) ++card.useCnt;
                else if (trigger == 'skill' && card.useCnt >= 3) card.useCnt -= 3;
            }, { addDmgCdt: isCdt(card.useCnt >= 3, 1) }]
        }, ['getdmg', 'heal', 'skill']), { expl: talentExplain(1011, 0), anydice: 2 }),

    785: new GICard(785, '｢诸君听我颂，共举爱之杯！｣', '[战斗行动]：我方出战角色为【芙宁娜】时，装备此牌。；【芙宁娜】装备此牌后，立刻使用一次【孤心沙龙】。；装备有此牌的【芙宁娜】使用【孤心沙龙】时，会对自身附属【万众瞩目】。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Furina.webp',
        3, 1, 0, [6, 7], 1111, 1, talentSkill(1), { expl: [...talentExplain(1111, 1), heroStatus(2196)] }),

    786: new GICard(786, '地狱里摇摆', '[战斗行动]：我方出战角色为【辛焱】时，装备此牌。；【辛焱】装备此牌后，立刻使用一次【炎舞】。；【装备有此牌的辛焱使用技能时：】如果我方手牌数量不多于1，则造成的伤害+2。(每回合1次)',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Xinyan.webp',
        1, 2, 0, [6, 7], 1212, 1, (card, event) => talentHandle(event, 0, () => {
            const { hcards = [] } = event;
            if (hcards.length > 1 || card.perCnt == 0) return;
            return [() => { --card.perCnt }, { addDmgCdt: 2 }]
        }, 'skill'), { pct: 1, expl: talentExplain(1212, 0), anydice: 2 }),

    787: new GICard(787, '庄谐并举', '[战斗行动]：我方出战角色为【云堇】时，装备此牌。；【云堇】装备此牌后，立刻使用一次【破嶂见旌仪】。；装备有此牌的【云堇】在场时，我方没有手牌，则【飞云旗阵】会使｢普通攻击｣造成的伤害额外+2。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Yunjin.webp',
        3, 6, 0, [6, 7], 1507, 1, (_card, event) => talentHandle(event, 2, () => {
            const { hcards = [] } = event;
            if (hcards.length > 0) return;
            return [() => ({}), { addDmgCdt: 2 }]
        }, ['skilltype1', 'other-skilltype1']), { expl: talentExplain(1507, 2), energy: 2 }),

    788: new GICard(788, '预算师的技艺', '[战斗行动]：我方出战角色为【卡维】时，装备此牌。；【卡维】装备此牌后，立刻使用一次【画则巧施】。；装备有此牌的【卡维】为出战角色，我方触发【迸发扫描】的效果后：将1张所[舍弃]卡牌的复制加入你的手牌。如果该牌为｢场地｣牌，则使本回合中我方下次打出｢场地｣时少花费2个元素骰。(每回合1次)',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Kaveh.webp',
        3, 7, 0, [6, 7], 1608, 1, talentSkill(1), { pct: 1, expl: talentExplain(1608, 1) }),

    789: new GICard(789, '无光鲸噬', '[战斗行动]：我方出战角色为【吞星之鲸】时，装备此牌。；【吞星之鲸】装备此牌后，立刻使用一次【迸落星雨】。；装备有此牌的【吞星之鲸】使用【迸落星雨】[舍弃]1张手牌后：治疗此角色该手牌元素骰费用的点数。(每回合1次)',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Ptahur.webp',
        4, 1, 0, [6, 7], 1724, 1, (card, event) => talentHandle(event, 1, () => {
            if (card.perCnt == 0) return;
            const { hcards = [] } = event;
            return [() => { --card.perCnt }, { execmds: [{ cmd: 'heal', cnt: Math.max(...hcards.map(c => c.cost + c.anydice)) }] }]
        }, 'skilltype2'), { pct: 1, expl: talentExplain(1724, 1) }),

    790: new GICard(790, '亡雷凝蓄', '【入场时：】生成1张【噬骸能量块】，置入我方手牌。；装备有此牌的【圣骸毒蝎】在场时，我方打出【噬骸能量块】后：摸1张牌，然后生成1张【噬骸能量块】，随机置入我方牌库中。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_ScorpionSacred.webp',
        1, 3, 0, [6], 1765, 1, (_card, event) => {
            const { hcard } = event;
            return {
                trigger: ['card'],
                cmds: [{ cmd: 'getCard', cnt: 1, card: 906 }],
                execmds: isCdt(hcard?.id == 906, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'addCard', cnt: 1, card: 906 }]),
            }
        }),

    791: new GICard(791, '亡风啸卷', '【入场时：】生成1张【噬骸能量块】，置入我方手牌。；装备有此牌的【圣骸毒蝎】在场时，我方打出【噬骸能量块】后：本回合中，我方下次切换角色后，生成1个出战角色类型的元素骰。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_ChrysopeleaSacred.webp',
        1, 5, 0, [6], 1783, 1, (_card, event) => {
            const { hcard } = event;
            return {
                trigger: ['card'],
                cmds: [{ cmd: 'getCard', cnt: 1, card: 906 }],
                execmds: isCdt(hcard?.id == 906, [{ cmd: 'getStatus', status: [heroStatus(2208)] }]),
            }
        }),

    792: new GICard(792, '万千子嗣', '【入场时：】生成4张【唤醒眷属】，随机置入我方牌库。；装备有此牌的【阿佩普的绿洲守望者】在场时，我方造成的伤害+1。',
        'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Apep.webp',
        2, 7, 0, [6], 1822, 1, () => ({ cmds: [{ cmd: 'addCard', cnt: 4, card: 907 }], addDmg: 1 })),

    ...extraCards,

}

const cardTotal: GICard[] = [];

for (const id in allCards) {
    cardTotal.push(allCards[id]);
}

const cardsTotal = (id: number) => allCards[id];

export {
    cardsTotal,
    cardTotal,
    GICard,
}
