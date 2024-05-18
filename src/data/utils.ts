
// 获取所有存活/死亡角色的索引hidx
export const allHidxs = (heros?: Hero[], options: { isDie?: boolean, exclude?: number, isAll?: boolean } = {}): number[] => {
    const { isDie = false, exclude = -1, isAll = false } = options;
    return heros?.map((h, hi) => ({ hi, hp: h.hp }))
        .filter(v => isAll || ((isDie ? v.hp <= 0 : v.hp > 0) && (exclude == -1 || exclude != v.hi)))
        .map(v => v.hi) ?? [];
}

// 深拷贝对象
export const clone = <T>(obj: T, notUse: boolean = false): T => {
    if (obj == undefined || notUse) return obj;
    return JSON.parse(JSON.stringify(obj));
}

// 获取受伤最多的角色的hidxs(只有一个number的数组)
export const getMaxHertHidxs = (heros: Hero[], fhidx?: number): number[] => {
    fhidx = fhidx ?? heros.findIndex(h => h.isFront);
    if (fhidx == -1) return [];
    const maxHert = Math.max(...heros.filter(h => h.hp > 0).map(h => h.maxhp - h.hp));
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hidx = (i + fhidx) % heros.length;
        const hert = heros[hidx].maxhp - heros[hidx].hp;
        if (heros[hidx].hp > 0 && hert == maxHert) {
            hidxs.push(hidx);
            break;
        }
    }
    return hidxs;
}

// 获取受伤最少的角色的hidxs(只有一个number的数组)
export const getMinHertHidxs = (heros: Hero[], fhidx?: number): number[] => {
    fhidx = fhidx ?? heros.findIndex(h => h.isFront);
    if (fhidx == -1) return [];
    const minHert = Math.min(...heros.filter(h => h.hp > 0).map(h => h.maxhp - h.hp));
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hidx = (i + fhidx) % heros.length;
        const hert = heros[hidx].maxhp - heros[hidx].hp;
        if (heros[hidx].hp > 0 && hert == minHert) {
            hidxs.push(hidx);
            break;
        }
    }
    return hidxs;
}

// 获取攻击角色hidx
export const getAtkHidx = (heros: Hero[]): number => {
    return heros.some(h => h.isSelected > 0) ? heros.findIndex(h => h.isSelected) : heros.findIndex(h => h.isFront);
}

// 获得距离出战角色最近的hidx
export const getNearestHidx = (hidx: number, heros: Hero[]): number => {
    let res = hidx;
    const livehidxs = allHidxs(heros);
    if (heros[hidx].hp <= 0) {
        const [[nhidx]] = livehidxs.map(v => [v, Math.abs(v - res)])
            .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        res = nhidx;
    }
    return res;
}

// 获得所有后台角色hidx
export const getBackHidxs = (heros: Hero[], frontIdx: number = -1): number[] => {
    const hidxs = heros.map((h, hi) => ({ hi, hp: h.hp, isFront: h.isFront }))
        .filter(v => {
            if (frontIdx == -1 && v.isFront) frontIdx = v.hi;
            return v.hp > 0 && (frontIdx == -1 ? !v.isFront : v.hi != frontIdx)
        }).map(v => v.hi) ?? [];
    return hidxs.slice(frontIdx).concat(hidxs.slice(0, frontIdx));
}

// 序列化函数
export const funcStringfy = <T>(obj: T): string => {
    return JSON.stringify(obj, (_, v) => {
        if (typeof v == 'function') return `${v}`;
        return v;
    });
}

// 反序列化函数
export const funcParse = (jsonStr: string | undefined): Function | undefined => {
    if (jsonStr == undefined) return undefined;
    return JSON.parse(jsonStr, (_, v) => {
        if (v && typeof v == 'string') {
            return new Function(`return ${v}`)();
        }
        return () => { }
    })
}

// 处理减少技能骰子函数
export const minusDiceSkillHandle = (event: { heros?: Hero[], hidxs?: number[], hidx?: number, hero?: Hero, isSkill?: number, minusDiceSkill?: number[][], trigger?: Trigger },
    skills: { skill?: number[], skilltype1?: number[], skilltype2?: number[], skilltype3?: number[] },
    cdt: ((skill: Skill) => boolean) = (() => true)): {
        isMinusSkill: boolean,
        minusSkillRes: { minusDiceSkill: number[][], minusDiceSkills: number[][] }
    } => {
    const { heros = [], hidxs = [], hidx = -1, isSkill: skidx = -1, minusDiceSkill: mds, hero = heros[hidxs[0] ?? hidx], trigger = '' } = event;
    const triggers: Trigger[] = Reflect.ownKeys(skills) as Trigger[];
    if (!mds || ![...triggers, 'calc'].includes(trigger)) {
        return { isMinusSkill: false, minusSkillRes: { minusDiceSkill: [], minusDiceSkills: [] } }
    }
    const { skill: nskill, skilltype1, skilltype2, skilltype3 } = skills;
    const nskillstype = [skilltype1, skilltype2, skilltype3];
    let isMinusSkill = true;
    const minusDiceSkills: number[][] = [];
    for (let i = 0; i < hero.skills.length; ++i) {
        const curskill = hero.skills[i];
        if (curskill.type == 4) break;
        if ((mds[i] ?? []).every(v => v <= 0) || !nskill && !nskillstype[curskill.type - 1] || !cdt(curskill)) {
            if (skidx == i) isMinusSkill = false;
            minusDiceSkills.push([0, 0]);
            continue;
        }
        const skti = nskillstype[curskill.type - 1] ?? [0, 0, 0];
        const sk = nskill ?? [0, 0, 0];
        const minusSum = [0, 0].map((_, mi) => sk[mi] + skti[mi]);
        let minusSum2 = sk[2] + skti[2];
        if (mds[i][0] - minusSum[0] > 0) {
            const minusCnt = Math.min(minusSum2, mds[i][0] - minusSum[0]);
            minusSum[0] += minusCnt;
            minusSum2 -= minusCnt;
        }
        minusSum[1] += minusSum2;
        mds[i][0] = Math.max(0, mds[i][0] - minusSum[0]);
        mds[i][1] = Math.max(0, mds[i][1] - minusSum[1]);
        minusDiceSkills.push(minusSum);
    }
    return { isMinusSkill, minusSkillRes: { minusDiceSkill: mds, minusDiceSkills } }
}

// 符合条件就返回，否则返回undefined
export const isCdt = <T>(cdt: boolean | null | undefined, res: T, elres?: T): T | undefined => {
    if (cdt) return res;
    if (elres == undefined) return undefined;
    return elres;
}

const CODE_IDX_LIST: number[] = [0, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1101, 1102, 1103, 1106, 1104, 1105, 1107, 1108, 1201, 1202, 1203, 1206, 1204, 1205, 1207, 1208, 1209, 1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310, 1401, 1402, 1403, 1404, 1405, 1406, 1501, 1502, 1504, 1505, 1503, 1601, 1602, 1603, 1604, 1605, 1701, 1721, 1722, 1741, 1742, 1761, 1781, 1801, 1821, 701, 712, 717, 718, 702, 732, 736, 753, 716, 703, 704, 737, 731, 733, 749, 758, 705, 708, 713, 738, 719, 727, 739, 750, 756, 709, 714, 720, 728, 729, 730, 740, 741, 752, 759, 706, 707, 742, 743, 751, 755, 710, 715, 744, 754, 734, 711, 735, 745, 757, 760, 746, 721, 722, 723, 748, 747, 724, 725, 726, 1, 2, 3, 4, 5, 21, 22, 23, 24, 25, 26, 41, 42, 43, 44, 45, 61, 62, 63, 64, 65, 66, 81, 82, 83, 84, 85, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 401, 402, 403, 404, 563, 562, 564, 561, 565, 587, 588, 581, 582, 583, 584, 585, 586, 589, 590, 591, 592, 593, 594, 571, 572, 573, 574, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 570, 578, 515, 516, 517, 518, 519, 520, 521, 522, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612];
// 4.3
CODE_IDX_LIST.push(1702, 1802, 1009, 1109, 1210, 1407, 1506, 1606, 1743, 1762, 1782, 761, 762, 763, 764, 765, 766, 767, 768, 769, 770, 771, 6, 7, 46, 67, 86, 118, 119, 120, 121, 122, 216, 217, 321, 405, 406, 566, 523, 524, 525, 613);
// 4.4
CODE_IDX_LIST.push(1211, 1408, 1703, 1763, 772, 773, 774, 775, 87, 123, 322, 323, 526, 527, 614);
// 4.5
CODE_IDX_LIST.push(1010, 1110, 1607, 1764, 776, 777, 778, 779, 8, 125, 218, 407, 567, 528);
// 4.6
CODE_IDX_LIST.push(1311, 1409, 1723, 1744, 780, 781, 782, 783, 68, 127, 219, 324, 325, 529, 615);
// 4.7
CODE_IDX_LIST.push(1011, 1111, 1212, 1507, 1608, 1724, 1765, 1783, 1822, 784, 785, 786, 787, 788, 789, 790, 9, 27, 47, 88, 124, 126, 128, 220, 221, 326, 408, 575, 530);

// 生成分享码
export const genShareCode = (ids: number[], salt = 0): string => {
    const ostr = ids.map(id => (CODE_IDX_LIST.indexOf(id)).toString(2).padStart(12, '0')).join('').padEnd(400, '0');
    const farr: number[] = [];
    for (let i = 0; i < 25; ++i) {
        farr.push((parseInt(ostr.slice(i * 8, (i + 1) * 8), 2) + salt) % 256);
        farr.push((parseInt(ostr.slice(i * 8 + 200, (i + 1) * 8 + 200), 2) + salt) % 256);
    }
    farr.push(salt);
    return btoa(String.fromCharCode(...farr));
}

// 解析分享码
export const parseShareCode = (code: string): { heroIds: number[], cardIds: number[] } => {
    const salt = atob(code).split('').at(-1)?.charCodeAt(0) ?? 0;
    const ores = atob(code).split('').map(v => ((v.charCodeAt(0) - salt + 256) % 256).toString(2).padStart(8, '0')).join('');
    let str1 = '';
    let str2 = '';
    for (let i = 0; i < 50; i += 2) {
        str1 += ores.slice(i * 8, (i + 1) * 8);
        str2 += ores.slice((i + 1) * 8, (i + 2) * 8);
    }
    const str = str1 + str2;
    const res: number[] = [];
    for (let i = 0; i < 33; ++i) {
        res.push(CODE_IDX_LIST[parseInt(str.slice(i * 12, (i + 1) * 12), 2)]);
    }
    const heroIds = res.slice(0, 3);
    const cardIds = res.slice(3).filter(v => v > 0);
    return { heroIds, cardIds }
}