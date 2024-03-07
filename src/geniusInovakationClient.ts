import type { Socket } from "socket.io-client";

import { herosTotal, readySkill } from '@/data/heros';
import { cardsTotal } from '@/data/cards';
import { heroStatus } from '@/data/heroStatus';
import { newSummonee } from '@/data/summonee';
import { newSite } from "@/data/site";
import { ELEMENT, ELEMENT_ICON } from "@/data/constant";
import { allHidxs, clone, getAtkHidx, getNearestHidx, isCdt, parseShareCode } from "@/data/utils";

export default class GeniusInvokationClient {
    socket: Socket;
    userid: number; // 用户id
    players: Player[]; // 所有玩家信息数组
    player: Player; // 本玩家
    opponent: Player; // 对手玩家
    isValid: boolean = false; // 牌型是否合法
    isStart: boolean = false; // 是否开始游戏
    isDeckEdit: boolean = false; // 是否进入编辑卡组界面
    phase: number = PHASE.NOT_BEGIN; // 阶段
    handCards: Card[] = []; // 手牌
    skills: Skill[] = []; // 技能栏
    showRerollBtn: boolean = true; // 是否显示重投按钮
    rollCnt: number = -1; // 可重投的次数
    isReconcile: boolean = false; // 是否进入调和模式
    willAttachs: number[][] = [[], [], [], [], [], []]; // 将要附着的元素
    willDamages: number[][] = new Array(6).fill([-1, 0]); // 将要受到的伤害
    dmgElements: number[] = [0, 0, 0]; // 造成伤害元素
    willHeals: number[] = [-1, -1, -1, -1, -1, -1]; // 回血量
    willHp: (number | undefined)[] = new Array(6).fill(undefined); // 总共的血量变化
    elTips: [string, number, number][] = new Array(6).fill(['', 0, 0]); // 元素反应提示
    isShowDmg: boolean = false; // 是否显示伤害数
    isShowHeal: boolean = false; // 是否显示加血数
    isShowChangeHero: number = 0; // 是否显示切换角色按钮 0不显示 1显示 2显示且为快速行动
    isFall: boolean = false; // 是否为下落攻击状态
    canAction: boolean = false; // 是否可以操作
    willSummons: Summonee[][] = [[], []]; // 将要召唤的召唤物
    willSwitch: boolean[] = [false, false, false, false, false, false]; // 是否将要切换角色
    siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]]; // 支援物变化数
    summonCnt = [[0, 0, 0, 0], [0, 0, 0, 0]]; // 召唤物变化数
    canSelectHero: number = 0; // 可以选择角色的数量
    heroChangeDice: number = 1; // 切换角色消耗的骰子数
    isSwitchAtking = false; // 是否有切换后的攻击
    isReseted = true; // 是否已重置
    taskQueue: TaskQueue;
    round: number = 0; // 回合数
    isWin: number = -1; // 胜者idx
    playerIdx: number = -1; // 该玩家序号
    NULL_CARD: Card = { ...cardsTotal(0) };
    NULL_PLAYER: Player = {
        id: -1,
        name: '',
        rid: -1,
        handCards: [],
        heros: [],
        pile: [],
        site: [],
        summon: [],
        dice: [],
        diceSelect: [],
        status: -1,
        phase: -1,
        info: '',
        willGetCard: [],
        pidx: -1,
        hidx: -1,
        tarhidx: -1,
        did: -1,
        canAction: false,
        isOffline: false,
        isUsedSubType8: false,
        playerInfo: {
            artifactCnt: 0,
            artifactTypeCnt: 0,
            weaponCnt: 0,
            weaponTypeCnt: 0,
            talentCnt: 0,
            talentTypeCnt: 0,
            usedCardIds: [],
            destroyedSite: 0,
            oppoGetElDmgType: 0,
        },
    };
    NULL_MODAL: InfoVO = { isShow: false, type: -1, info: null };
    NULL_SKILL: Skill = herosTotal(0).skills[0];
    modalInfo: InfoVO = { ...this.NULL_MODAL }; // 展示信息
    tip: TipVO = { content: '' }; // 提示信息
    actionInfo: string = ''; // 行动信息
    currCard: Card = { ...this.NULL_CARD }; // 当前选择的卡
    currSkill: Skill = { ...this.NULL_SKILL }; // 当前选择的技能
    currHero: Hero | {} = {}; // 当前选择的角色
    exchangeSite: [Site, number][] = []; // 要交换的支援物
    decks: { name: string, shareCode: string }[] = [];
    deckIdx: number; // 出战卡组id
    editDeckIdx: number; // 当前编辑卡组idx
    log: string[] = []; // 当局游戏日志
    isMobile: boolean; // 是否为手机
    constructor(socket: Socket, userid: number, players: Player[], isMobile: boolean, decks: { name: string, shareCode: string }[], deckIdx = 0) {
        this.socket = socket;
        this.userid = userid;
        this.players = players;
        this.playerIdx = players.findIndex((p, pi) => p.id == this.userid && pi < 2);
        this.player = players.find(p => p.pidx == this.playerIdx) ?? { ...this.NULL_PLAYER };
        this.opponent = players.find(p => p.pidx == (this.playerIdx ^ 1)) ?? { ...this.NULL_PLAYER };
        this.deckIdx = deckIdx;
        this.editDeckIdx = deckIdx;
        this.decks = decks;
        this.taskQueue = new TaskQueue(socket);
        this.isMobile = isMobile;
    }
    /**
     * 取消选择
     */
    cancel(options: { onlyCard?: boolean, notCard?: boolean, notHeros?: boolean, onlyHeros?: boolean, onlySiteAndSummon?: boolean } = {}) {
        const { onlyCard = false, notCard = false, notHeros = false, onlyHeros = false, onlySiteAndSummon = false } = options;
        this.willHp = new Array(6).fill(undefined);
        if (!onlyCard) {
            if ((!notHeros || onlyHeros) && !onlySiteAndSummon) {
                this.players[this.playerIdx]?.heros.forEach(h => {
                    h.canSelect = false;
                    h.isSelected = 0;
                });
                if (onlyHeros) return;
            }
            if (!this.taskQueue.isExecuting || onlySiteAndSummon) {
                this.players.forEach(p => p.summon.forEach(smn => {
                    smn.canSelect = false;
                    smn.isSelected = false;
                }));
                this.players[this.playerIdx].site.forEach(site => {
                    site.canSelect = false;
                    site.isSelected = false;
                });
                if (onlySiteAndSummon) return;
            }
        }
        if (this.currCard.canSelectSite > -1 && this.modalInfo.type > -1) {
            this.modalInfo = { ...this.NULL_MODAL }
            return;
        }
        const sidx = this.handCards.findIndex(c => c.selected);
        if (!notCard) this.handCards.forEach(card => card.selected = false);
        if (this.isMobile && sidx > -1) {
            this.mouseleave(sidx, true);
        }
        if (onlyCard) return;
        this.modalInfo = { ...this.NULL_MODAL }
        this.currCard = { ...this.NULL_CARD };
        this.currSkill = { ...this.NULL_SKILL };
        this.willSummons = [[], []];
        this.willSwitch = [false, false, false, false, false, false];
        this.willAttachs = [[], [], [], [], [], []];
        this.siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        this.summonCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        this.isValid = false;
        this.isShowChangeHero = 0;
        this.isReconcile = false;
        this.players[this.playerIdx].diceSelect = this.players[this.playerIdx].dice.map(() => false);
    }
    /**
     * 展示选择卡的信息
     * @param idx 选择卡的索引idx
     */
    selectChangeCard(idx: number) {
        this.modalInfo = {
            isShow: true,
            type: 5,
            info: this.player.handCards[idx],
        }
    }
    /**
     * 选择卡
     * @param idx 选择卡的索引idx
     */
    selectCard(idx: number, callback: () => void) {
        if (this.player.status == 1) this.reconcile(false);
        this.currSkill = { ...this.NULL_SKILL };
        this.willSummons = [[], []];
        this.isShowChangeHero = 0;
        this.handCards.forEach((card, cidx) => {
            if (cidx == idx) {
                card.selected = !card.selected;
                if (card.selected) {
                    this.currCard = { ...this.handCards[idx] };
                    this.modalInfo = {
                        isShow: true,
                        type: 5,
                        info: card,
                    }
                } else {
                    this.modalInfo = { ...this.NULL_MODAL };
                    this.currCard = { ...this.NULL_CARD };
                    this.players[this.playerIdx].site.forEach(s => {
                        s.isSelected = false;
                        s.canSelect = false;
                    });
                    this.players[this.playerIdx].summon.forEach(s => {
                        s.canSelect = false;
                        s.isSelected = false;
                    });
                }
                if (this.isMobile) {
                    if (card.selected) this.mouseenter(idx, true);
                    else this.mouseleave(idx, true);
                }
            } else if (card.selected) {
                card.selected = false;
                if (this.isMobile) this.mouseleave(cidx, true);
            }
        });
        if (this.player.phase < PHASE.ACTION) return;
        this.player.heros.forEach(h => h.isSelected = 0);
        [...this.player.summon, ...this.opponent.summon].forEach(smn => smn.isSelected = false);
        if (this.player.status == 1) {
            const { isValid, diceSelect } = this.checkCard(callback);
            const { canSelectHero, canSelectSummon, canSelectSite } = this.currCard;
            this.isValid = isValid && canSelectHero == 0 && canSelectSummon == -1 && canSelectSite == -1;
            if ([2, 3, 4].some(sbtp => this.currCard.subType.includes(sbtp))) {
                const isAvalible = this.player.site.length < 4;
                this.isValid = this.isValid && isAvalible;
                if (!isAvalible) this.players[this.playerIdx].site.forEach(s => s.canSelect = true);
            }
            this.players[this.playerIdx].diceSelect = [...diceSelect];
            if (isValid && !this.isValid) {
                this.isValid = true;
                if (canSelectHero == 1 && this.player.heros.filter(h => h.canSelect).length == 1) {
                    this.player.heros.forEach(h => h.isSelected = h.canSelect ? 1 : 0);
                } else if (canSelectSummon == 0 && this.opponent.summon.filter(smn => smn.canSelect).length == 1) {
                    this.opponent.summon.forEach(smn => smn.isSelected = smn.canSelect);
                } else if (canSelectSummon == 1 && this.player.summon.filter(smn => smn.canSelect).length == 1) {
                    this.player.summon.forEach(smn => smn.isSelected = smn.canSelect);
                } else if (canSelectSite == 1 && this.player.site.filter(st => st.canSelect).length == 1) {
                    this.player.site.forEach(st => st.isSelected = st.canSelect);
                } else this.isValid = false;
            }
        }
    }
    /**
     * 检查选择的卡的合法性并自动选择合适的骰子
     * @returns  isValid: 选择的卡是否合法, diceSelect: 是否选择骰子的数组
     */
    checkCard(callback?: () => void) {
        let { cost, costType, canSelectHero, type, userType, id, canSelectSite,
            subType, anydice, costChange, canSelectSummon, energy } = this.currCard;
        const { dice, heros, hidx, summon, isUsedSubType8 } = this.player;
        cost = Math.max(0, cost - costChange);
        let isValid: boolean = false;
        let diceSelect: boolean[] = [];
        const diceLen = dice.length;
        const cardres = cardsTotal(id)?.handle(this.currCard, {
            heros,
            hidxs: [hidx],
            ephase: this.opponent.phase,
            dices: dice,
            round: this.round,
            hcardsCnt: this.handCards.length,
            ehcardsCnt: this.opponent.handCards.length,
            esiteCnt: this.opponent.site.length,
            esummonCnt: this.opponent.summon.length,
        });
        if (cardres?.hidxs?.length == 0 ||
            cardres?.summon && summon.length == 4 ||
            cardres?.isValid == false ||
            subType.includes(8) && isUsedSubType8 ||
            heros[hidx].energy < energy
        ) {
            return { isValid: false, diceSelect: new Array(diceLen).fill(false) };
        }
        this.players[this.playerIdx].heros.forEach((hero, i) => {
            const canSelectHeros = cardres?.canSelectHero?.[i] ?? (hero.hp > 0);
            hero.canSelect = canSelectHero > 0 && canSelectHeros && (
                type == 1 || type == 2 && subType.length == 0 ||
                subType.includes(0) && userType == hero.weaponType ||
                subType.includes(1) || subType.includes(9) ||
                subType.includes(5) && !hero.inStatus.some(ist => ist.id == 2009) ||
                subType.includes(6) && userType == hero.id && (hero.isFront || !subType.includes(7)) ||
                subType.includes(7) && userType == 0
            );
        });
        if (userType == 0 && canSelectHero == heros.filter(h => h.isSelected).length ||
            userType == this._getFrontHero().id && canSelectHero == heros.filter(h => h.canSelect).length
        ) {
            this._doCmds([...(cardres.cmds ?? []), ...(cardres.execmds ?? [])], { callback, isCard: true, isOnlyRead: true, isExec: false });
        }
        this.players.forEach(p => {
            p.summon.forEach(smn => {
                smn.canSelect = canSelectSummon > -1 && (p.pidx ^ canSelectSummon) != this.playerIdx;
                if (canSelectSummon == -1) smn.isSelected = false;
            });
            p.site.forEach(st => {
                st.canSelect = canSelectSite > -1 && (p.pidx ^ canSelectSite) != this.playerIdx;
                if (canSelectSite == -1) st.isSelected = false;
            });
        });
        if (this.isReconcile) [cost, costType] = [1, 0];
        if (cost <= 0) return { isValid: cost == 0, diceSelect: new Array(diceLen).fill(false) };
        if (costType == 0) {
            isValid = cost <= diceLen;
            if (isValid) {
                for (let i = 0, tmpcost = cost; i < diceLen; ++i) {
                    diceSelect.unshift(tmpcost-- > 0);
                }
            }
            return { isValid, diceSelect };
        }
        const diceCnt: number[] = new Array(8).fill(0);
        dice.forEach(d => ++diceCnt[d]);
        if (costType < 8) {
            isValid = cost <= diceCnt[costType] + diceCnt[0] && anydice <= diceLen - cost;
            if (isValid) {
                for (let i = 0, tmpcost = anydice; i < diceLen && tmpcost > 0; ++i) {
                    diceSelect.unshift(tmpcost-- > 0);
                }
                for (let i = diceLen - anydice - 1, tmpcnt = cost; i >= 0; --i) {
                    const idx = dice[i];
                    if (idx != costType && idx > 0) diceSelect.unshift(false);
                    else diceSelect.unshift(tmpcnt-- > 0);
                }
            } else diceSelect = new Array(diceLen).fill(false);
            return { isValid, diceSelect };
        }
        isValid = diceCnt.some((n, i) => (i > 0 ? n : 0) + diceCnt[0] >= cost);
        if (isValid) {
            let maxidx = -1;
            const frontIdx = this._getFrontHero().element;
            for (let i = diceLen - 1, max = 0; i >= 0; --i) {
                const idx = dice[i];
                if (idx == 0) break;
                const cnt = diceCnt[idx];
                if (cnt >= cost) {
                    if (idx == frontIdx && maxidx > -1 && max + diceCnt[0] >= cost) break;
                    maxidx = idx;
                    break;
                }
                if (cnt > max && (diceCnt[frontIdx] <= cnt || cost - cnt <= diceCnt[frontIdx])) {
                    max = cnt;
                    maxidx = idx;
                }
            }
            for (let i = diceLen - 1, tmpcnt = cost; i >= 0; --i) {
                const idx = dice[i];
                if (idx != maxidx && idx > 0) diceSelect.unshift(false);
                else diceSelect.unshift(tmpcnt-- > 0);
            }
        } else diceSelect = new Array(diceLen).fill(false);
        return { isValid, diceSelect };
    }
    /**
     * 使用卡
     */
    useCard(callback: () => void) {
        if (!this.isValid) return;
        const player = this.players[this.playerIdx];
        const hidxs = player.heros.map((h, i) => ({ hidx: i, val: h.isSelected }))
            .filter(v => v.val > 0).sort((a, b) => a.val - b.val).map(v => v.hidx);
        const handCards = this.handCards.filter(c => !c.selected);
        const currCard = { ...this.currCard, selected: false };
        if (currCard.type == 1 && player.site.length == 4) {
            ++this.players[this.playerIdx].playerInfo.destroyedSite;
        }
        const oSiteCnt = player.site.length;
        const cardres = cardsTotal(currCard.id).handle(currCard, {
            hidxs,
            heros: player.heros,
            eheros: this.opponent.heros,
            summons: player.summon,
            esummons: this.opponent.summon,
            hcardsCnt: this.handCards.length,
            ehcardsCnt: this.opponent.handCards.length,
            round: this.round,
            playerInfo: player.playerInfo,
            site: player.site,
        });
        this.players[this.playerIdx].playerInfo.destroyedSite += oSiteCnt - player.site.length;
        player.heros.forEach(h => {
            h.isSelected = 0;
            h.canSelect = false;
        });
        if (currCard.type != 0) cardres?.exec?.();
        let { minusDiceCard } = this._doSlot('card', { hidxs: allHidxs(player.heros, { isAll: true }), hcard: currCard });
        const { isInvalid, minusDiceCard: stsmdc } = this._doStatus(this.playerIdx, 4, 'card', { card: currCard, isOnlyFront: true, minusDiceCard });
        if (isInvalid) {
            this.socket.emit('sendToServer', {
                handCards,
                currCard,
                heros: player.heros,
                flag: `useCard-${currCard.name}-invalid-${this.playerIdx}`,
            });
        } else {
            const cardcmds = [...(cardres?.cmds ?? []), ...(cardres?.execmds ?? [])];
            const { cmds: otherCmds } = this._doSite(this.playerIdx, 'card', { hcard: currCard, minusDiceCard: stsmdc });
            cardcmds.push(...otherCmds);
            let aHeros: Hero[] = clone(player.heros);
            let aSummon: Summonee[] = this._updateSummon([], player.summon, player.heros[player.hidx].outStatus);
            let esummon: Summonee[] = this._updateSummon([], this.opponent.summon, this.opponent.heros[this.opponent.hidx].outStatus);
            let elTips: [string, number, number][] | undefined = undefined;
            if (currCard.type == 0) {
                const explIdx = currCard.description.indexOf('；(');
                currCard.description = currCard.description.slice(0, explIdx);
                if (
                    currCard.subType.includes(0) && aHeros[hidxs[0]].weaponSlot != null ||
                    currCard.subType.includes(1) && aHeros[hidxs[0]].artifactSlot != null ||
                    currCard.subType.includes(6) && aHeros[hidxs[0]].talentSlot != null
                ) {
                    const { cmds = [] } = this._doStatus(this.playerIdx, 4, 'slot-destroy', { isOnlyOutStatus: true, card: currCard });
                    cardcmds.push(...cmds);
                }
            }
            aHeros = clone(player.heros);
            const isUseSkill = cardcmds.some(c => c.cmd == 'useSkill');
            const { ndices, phase = player.phase, heros, willHeals, isSwitch = -1 } = this._doCmds(cardcmds, { callback, isCard: true, hidxs: isCdt(hidxs.length > 0, hidxs) });
            const heal = willHeals?.slice(3 - this.playerIdx * 3, 6 - this.playerIdx * 3).map(v => Math.max(0, v) % 100);
            if (heal?.some(hl => hl > 0)) {
                this._doSlot('heal', { hidxs: allHidxs(aHeros, { isAll: true }), heal, isEndAtk: currCard.subType.includes(7) });
                this._doStatus(this.playerIdx, 4, 'heal', { heal });
            }
            if (heros) aHeros = [...heros];
            if (cardcmds.length > 0) {
                for (let i = 0; i < cardcmds.length; ++i) {
                    const { cmd = '', element = 0, hidxs: chidxs } = cardcmds[i];
                    if (!chidxs) cardcmds[i].hidxs = [...hidxs];
                    if (cmd == 'attach') {
                        (chidxs ?? []).forEach((hidx, hi) => {
                            const { summon: asummon1, eheros: eheros1,
                                summonOppo: esummon1, elTips: elTips1
                            } = this._elementReaction(
                                typeof element == 'number' ? element == -1 ? aHeros[player.hidx].element : element : element[hi],
                                [[-1, 0], [-1, 0], [-1, 0]],
                                hidx,
                                aHeros, aSummon,
                                this.opponent.heros, esummon,
                                { isAttach: true, elTips },
                            );
                            aHeros = [...eheros1];
                            aSummon = [...asummon1];
                            esummon = [...esummon1];
                            elTips = [...elTips1];
                        });
                    }
                }
            }
            if (cardres?.hidxs && currCard.type > 0) hidxs.splice(0, 3, ...cardres.hidxs);
            const site: Site[] = [...player.site];
            let isSiteDestroy = false;
            if (cardres?.site) {
                if (site.length == 4) {
                    const selectSiteIdx = site.findIndex(site => site.isSelected);
                    site.splice(selectSiteIdx, 1);
                    isSiteDestroy = true;
                }
                site.push(...cardres.site);
            }
            if (oSiteCnt - player.site.length > 0) isSiteDestroy = true;
            if (isSiteDestroy) this._doSite(this.playerIdx, 'site-destroy', { csite: site });
            aSummon = this._updateSummon(cardres?.summon ?? [], aSummon, aHeros[player.hidx].outStatus);
            esummon = this._updateSummon([], esummon, this.opponent.heros[this.opponent.hidx].outStatus);
            let outStatusOppo: Status[] = this.opponent.heros[this.opponent.hidx].outStatus;
            if (cardres?.inStatus) {
                aHeros.forEach((h, hi, ha) => {
                    if (hidxs.includes(hi)) {
                        const { nstatus, nheros } = this._updateStatus(cardres.inStatus ?? [], h.inStatus, ha, hi);
                        if (nheros) {
                            ha[hi] = nheros[hi];
                            ha[hi].inStatus = [...nstatus];
                        }
                    }
                });
            }
            if (cardres?.outStatus) {
                const { nstatus, nheros } = this._updateStatus(cardres?.outStatus ?? [], aHeros[player.hidx].outStatus, aHeros, player.hidx);
                if (nheros) {
                    aHeros[player.hidx] = nheros[player.hidx];
                    aHeros[player.hidx].outStatus = [...nstatus];
                }
            }
            if (cardres?.outStatusOppo) {
                const { nstatus, nheros } = this._updateStatus(cardres?.outStatusOppo ?? [], outStatusOppo, this.opponent.heros, this.opponent.hidx);
                outStatusOppo = nstatus;
                if (nheros) {
                    this.opponent.heros[this.opponent.hidx] = nheros[this.opponent.hidx];
                    this.opponent.heros[this.opponent.hidx].outStatus = [...nstatus];
                }
            }
            player.heros = [...aHeros];
            let isAction = currCard.subType.includes(7);
            if (isAction) this.players[this.playerIdx].canAction = false;
            isAction &&= isUseSkill;
            if (isSwitch > -1) {
                this._doStatus(this.playerIdx, 1, 'change-from', { heros: aHeros, isQuickAction: isCdt(!isAction, 2), isSwitchAtk: isUseSkill });
            }
            currCard.selected = false;
            currCard.costChange = 0;
            player.site.forEach(s => {
                s.canSelect = false;
                s.isSelected = false;
            });
            player.summon.forEach(s => {
                s.canSelect = false;
                s.isSelected = false;
            });
            this.socket.emit('sendToServer', {
                handCards,
                currCard,
                dices: ndices,
                hidxs,
                heros: isCdt(!isAction, player.heros),
                eheros: isCdt(!isAction, this.opponent.heros),
                cardres,
                site,
                summonee: isCdt(!isAction, aSummon),
                esummon,
                elTips,
                phase,
                playerInfo: this.players[this.playerIdx].playerInfo,
                flag: `useCard-${currCard.name}-${this.playerIdx}`,
            });
        }
        this.cancel();
    }
    /**
     * 鼠标进入卡
     * @param idx 进入的卡的索引idx
     * @param force 是否强制执行该函数
     * @returns void
     */
    mouseenter(idx: number, force = false) {
        if (this.isMobile && !force) return;
        this.handCards.forEach((card, cidx) => {
            if (cidx > idx) card.pos += (this.isMobile ? 25 : 45);
        });
    }
    /**
     * 鼠标离开卡
     * @param idx 离开的卡的索引idx
     * @param force 是否强制执行该函数
     */
    mouseleave(idx: number, force = false) {
        if (this.isMobile && !force) return;
        this.handCards.forEach((card, cidx) => {
            if (cidx > idx) card.pos = Math.max(cidx * (this.isMobile ? 36 : 48), card.pos - (this.isMobile ? 25 : 45));
        });
    }
    /**
     * 开始游戏
     */
    startGame() {
        if (this.players.length < 2) return alert(`玩家为2人才能开始游戏`);
        const odeck = this.decks[this.deckIdx];
        const deck = {
            name: odeck.name,
            ...parseShareCode(odeck.shareCode),
        };
        if (deck == undefined) return console.error('卡组未找到');
        if (deck.heroIds.includes(0) || deck.cardIds.length < 30) return alert(`当前出战卡组不完整`);
        console.info(`player[${this.players[this.playerIdx].name}]:${this.isStart ? 'cancelReady' : 'startGame'}`);
        this.isStart = !this.isStart;
        this.isWin = -1;
        this.socket.emit('sendToServer', {
            phase: this.players[this.playerIdx].phase ^ 1,
            cpidx: this.playerIdx,
            did: this.deckIdx,
            heros: deck.heroIds.map(herosTotal),
            cards: deck.cardIds.map(cardsTotal),
            flag: 'startGame-' + this.playerIdx,
        });
    }
    /**
     * 保存牌组
     * @param decks 牌组
     * @param didx 牌组索引idx
     */
    saveDeck(deck: { name: string, shareCode: string }, didx: number) {
        this.decks[didx] = { ...deck };
        return this.decks;
    }
    /**
     * 编辑卡组
     * @param idx 编辑卡组的索引idx
     */
    editDeck(idx: number) {
        this.isDeckEdit = true;
        this.editDeckIdx = idx;
    }
    /**
     * 选择卡组
     * @param did 选择卡组的id
     */
    selectDeck(didx: number) {
        this.deckIdx = didx;
        return this.deckIdx;
    }
    /**
     * 删除卡组
     * @param did 删除卡组的索引idx
     */
    deleteDeck(didx: number) {
        this.decks[didx] = { name: '默认卡组', shareCode: '00000000' };
        return this.decks;
    }
    /**
     * 格式化手牌、技能
     * @param player 玩家对象
     * @param options isUpdateHandcards 是否更新手牌, hero 切换后的角色
     */
    wrap(player: Player, options: { isUpdateHandcards?: boolean, hero?: Hero, switchIdx?: number } = {}) {
        if (player == undefined || player.handCards == undefined) return;
        const { isUpdateHandcards = true, hero, switchIdx = -1 } = options;
        const frontHero = hero ?? (switchIdx == -1 ? this._getFrontHero() : player.heros[switchIdx]);
        const skills: Skill[] = [];
        if (frontHero) {
            for (const skill of frontHero.skills) {
                if (skill.type < 4) {
                    const cskill: Skill = { ...skill, isForbidden: false };
                    const isLen = cskill.cost[0].val + cskill.cost[1].val - cskill.costChange[0] - cskill.costChange[1] > player.dice.length;
                    const isFront = (cskill.cost[0].color < 8 ?
                        player.dice.filter(d => d == 0 || d == cskill.cost[0].color).length :
                        player.dice.filter(d => d == 0).length + Math.max(...player.dice.reduce((a, c) => {
                            if (c > 0) ++a[c];
                            return a;
                        }, new Array(8).fill(0)))) < cskill.cost[0].val - cskill.costChange[0];
                    const isEnergy = cskill.cost[2].val > 0 && frontHero.energy < frontHero.maxEnergy;
                    cskill.isForbidden = isLen || isFront || isEnergy;
                    skills.push(cskill);
                }
            }
        }
        if (hero) return skills;
        if (isUpdateHandcards) {
            this.handCards = [];
            player.handCards.forEach((val, idx) => {
                const card: Card = {
                    ...val,
                    pos: idx * (this.isMobile ? 36 : 48),
                }
                this.handCards.push(card);
            });
        }
        this.skills = skills;
    }
    /**
     * 更新玩家位置上的信息
     */
    updatePlayerPositionInfo() {
        this.player = this.players[this.playerIdx];
        this.opponent = this.players[this.playerIdx ^ 1];
    }
    /**
     * 获取玩家信息
     * @param data 一些数据
     */
    getPlayer(data: any) {
        this.players = [...(data?.players ?? this.players)];
        if (data.isFlag) {
            this.socket.emit('sendToServer');
            this.isStart = data.isStart;
        }
        this.playerIdx = this.players.findIndex(p => p.id == this.userid);
        this.phase = data.phase;
        this.canAction = this.players[this.playerIdx]?.canAction ?? false;
        if (data.taskQueueVal) {
            this.taskQueue.queue = data.taskQueueVal.queue;
            this.taskQueue.isEndAtk = data.taskQueueVal.isEndAtk;
            this.taskQueue.isExecuting = data.taskQueueVal.isExecuting;
            this.taskQueue.statusAtk = data.taskQueueVal.statusAtk;
        }
        this.wrap(this.players[this.playerIdx]);
        this._clacCardChange();
        this.updatePlayerPositionInfo();
    }
    /**
     * 从服务器获取数据
     * @param data players: 玩家信息, winnerIdx: 胜者索引idx, phase: 游戏阶段, log: 日志
     * @param callback 上层updateInfo回调函数
     */
    async getServerInfo(data: any, isLookon: boolean, callback: () => void) {
        const { players, winnerIdx, phase, round, log, isSendActionInfo, dmgElements,
            willDamage, willHeals, startIdx, isUseSkill, dieChangeBack, isChangeHero,
            changeTo, resetOnly, elTips, changeFrom, taskQueueVal, execIdx, cidx,
            actionStart, heroDie, chooseInitHero = false, isSwitchAtking = false,
            flag } = data;
        // console.info('server-flag:', flag);
        if (!isLookon) {
            this.players = players;
            return;
        }
        if (flag == 'game-end') {
            this.isStart = false;
            this.phase = phase;
            this.players = [...players];
            this.isWin += 2;
            this.updatePlayerPositionInfo();
            return;
        }
        if (winnerIdx > -1) this.isWin = winnerIdx;
        if (taskQueueVal != undefined) {
            this.taskQueue.queue = taskQueueVal.queue;
            this.taskQueue.isEndAtk = taskQueueVal.isEndAtk;
            this.taskQueue.isExecuting = taskQueueVal.isExecuting;
            this.taskQueue.statusAtk = taskQueueVal.statusAtk;
            return;
        }
        if (isSwitchAtking) this.isSwitchAtking = false;
        if (!resetOnly && this.phase > 1 && this.isWin == -1) {
            if (this.players[this.playerIdx]?.phase == PHASE.CHANGE_CARD &&
                players[this.playerIdx]?.phase == PHASE.CHOOSE_HERO) {
                this._sendTip('选择出战角色', callback);
            }
            const isMyTurn = () => players[this.playerIdx].heros[this.player.hidx].inStatus.every((ist: Status) => !ist.type.includes(14));
            if (this.player.status == 0 && players[this.playerIdx].status == 1 && phase == PHASE.ACTION) {
                this._sendTip('你的回合开始', callback);
                if (isMyTurn()) {
                    setTimeout(() => {
                        this._doStatus(this.playerIdx, 11, 'useReadySkill', { callback, isOnlyFront: true, isOnlyInStatus: true });
                    }, 200);
                }
                this.cancel();
            }
            if (this.opponent?.status == 0 && players[this.playerIdx ^ 1].status == 1 && phase == PHASE.ACTION) {
                this._sendTip('对方回合开始', callback);
            }
            if (players[this.playerIdx]?.phase == PHASE.ACTION && players[this.playerIdx ^ 1]?.phase == PHASE.ACTION_END &&
                (isUseSkill || isChangeHero) && !this.isSwitchAtking && !this.taskQueue.isExecuting &&
                this.taskQueue.isTaskEmpty() && dieChangeBack == undefined) {
                setTimeout(() => this._sendTip('继续你的回合', callback), 1500);
                if (isMyTurn()) {
                    setTimeout(() => {
                        this._doStatus(this.playerIdx, 11, 'useReadySkill', { callback, isOnlyFront: true, isOnlyInStatus: true });
                    }, 2500);
                }
                this.cancel();
            }
            if (players[this.playerIdx ^ 1]?.phase == PHASE.ACTION && players[this.playerIdx]?.phase == PHASE.ACTION_END &&
                (isUseSkill || isChangeHero) && !this.isSwitchAtking && !this.taskQueue.isExecuting) {
                setTimeout(() => this._sendTip('对方继续回合', callback), 2000);
            }
            if ([PHASE.ACTION, PHASE.ACTION_END].includes(this.player?.phase) &&
                [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(players[this.playerIdx].phase)) { // 我方出战角色阵亡
                this._sendTip('选择出战角色', callback);
            }
            if ([PHASE.ACTION, PHASE.ACTION_END].includes(this.opponent.phase) &&
                [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(players[this.playerIdx ^ 1].phase)) { // 对方出战角色阵亡
                this.canAction = false;
                this._sendTip('等待对方选择出战角色', callback);
            }
        }
        if (this.playerIdx == execIdx && dieChangeBack == undefined) {
            if (this.taskQueue.hasStatusAtk()) this.isSwitchAtking = true;
            this._execTask();
        }
        if (actionStart == this.playerIdx && ![PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(players[this.playerIdx].phase)) { // 我方选择行动前
            const { cmds } = this._doSite(this.playerIdx, 'action-start', { players });
            this._doStatus(this.playerIdx, [1, 4], 'action-start', { intvl: [100, 500, 1000, 100], players, isOnlyFront: true });
            this._doSummon(this.playerIdx, 'action-start', { intvl: [100, 700, 2000, 200] });
            this._execTask();
            if (cmds.length > 0) {
                const { ndices } = this._doCmds(cmds, { callback });
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    site: players[this.playerIdx].site,
                    dices: ndices,
                    cmds,
                    flag: 'actionStart-' + this.playerIdx,
                });
            }
        }
        const siteDiffCnt = this.players[this.playerIdx].site.length - players[this.playerIdx].site.length - this.exchangeSite.length;
        if (siteDiffCnt > 0) {
            players[this.playerIdx].playerInfo.destroyedSite += siteDiffCnt;
            this._doSite(this.playerIdx, 'site-destroy', { players });
        }
        const summonDiffCnt = this.players.flatMap(p => p.summon).length - players.flatMap((p: Player) => p.summon).length;
        if (summonDiffCnt > 0) {
            this._doSite(this.playerIdx, 'summon-destroy', { players, summonDiffCnt });
        }
        if (siteDiffCnt > 0 || summonDiffCnt > 0) {
            this.socket.emit('sendToServer', {
                cpidx: this.playerIdx,
                site: players[this.playerIdx].site,
                playerInfo: players[this.playerIdx].playerInfo,
                flag: 'diff-' + this.playerIdx,
            });
        }
        if (players[this.playerIdx]?.phase != PHASE.CHOOSE_HERO ||
            !chooseInitHero && !flag.startsWith('infoHandle:getServerInfo-changeTo')) {
            if (flag != 'endPhase-hasAddAtk') this.players = [...players];
            else this.players.forEach(p => p.status = p.status ^ 1);
        }
        if (round > 1 || this.player?.phase != PHASE.CHOOSE_HERO || changeTo == this.playerIdx) {
            if (this.players.some(p => p.heros.some(h => {
                return h.inStatus.some(ist => (ist.useCnt == 0 || ist.roundCnt == 0) && ist.type.every(t => ![9, 15].includes(t))) ||
                    h.outStatus.some(ost => (ost.useCnt == 0 || ost.roundCnt == 0) && ost.type.every(t => ![9, 15].includes(t)))
            }))) {
                this.players.forEach(p => p.heros.forEach((h, hi, ha) => {
                    const { nstatus: nist, nheros: inh } = this._updateStatus([], h.inStatus, ha, hi);
                    const { nstatus: nost, nheros: onh } = this._updateStatus([], h.outStatus, inh, hi);
                    if (onh) ha[hi] = onh[hi];
                    ha[hi].inStatus = nist;
                    ha[hi].outStatus = nost;
                }));
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    heros: this.players[this.playerIdx].heros,
                    eheros: this.players[this.playerIdx ^ 1].heros,
                    updateToServerOnly: true,
                    flag: 'getServerInfo-updateToServerOnly-' + this.playerIdx,
                });
            }
        }
        if (resetOnly) {
            this.isReseted = true;
            return;
        }
        const hasReadySkill = (this.players[this.playerIdx]?.heros?.[this.players[this.playerIdx]?.hidx]?.inStatus.some(ist => ist.type.includes(11)) ?? false) &&
            (this.players[this.playerIdx]?.heros?.[this.players[this.playerIdx]?.hidx]?.inStatus.every(ist => !ist.type.includes(14)) ?? false);

        this.canAction = !hasReadySkill && (this.players[this.playerIdx]?.canAction ?? false) && players[this.playerIdx].phase == PHASE.ACTION &&
            this.taskQueue.isTaskEmpty() && this.isStart;

        this.round = round;
        if ([PHASE.CHANGE_CARD, PHASE.ACTION_END].includes(this.phase) && phase == PHASE.DICE && changeTo == undefined) {
            this.phase = phase;
            this.rollCnt = 1;
            this.cancel();
            this._sendTip('骰子投掷阶段', callback);
            this.showRerollBtn = true;
            const dices = this.rollDice();
            if (dices) this.socket.emit('sendToServer', { cpidx: this.playerIdx, dices, flag: 'getServerInfo-phase-dice-' + this.playerIdx });
        }
        if (this.phase == PHASE.DICE && phase == PHASE.ACTION_START) { // 开始阶段
            this.showRerollBtn = true;
            this.isFall = false;
            this._sendTip(`第${this.round}轮开始`, callback);
            if (this.round == 1) this.phase = phase;
            setTimeout(async () => {
                this.isReseted = false;
                this.players[this.playerIdx].heros.forEach(h => { // 重置技能
                    for (let i = 0; i < h.skills.length; ++i) {
                        const skill = h.skills[i];
                        (skill.rdskidx == -1 ? herosTotal(h.id).skills[i] : readySkill(skill.rdskidx)).handle({ reset: true, hero: h, skidx: i });
                    }
                });
                this.players[this.playerIdx].site.forEach(site => { // 重置场地
                    newSite(site.id).handle(site, { reset: true });
                });
                const rOutStatus: Status[] = [];
                this.players[this.playerIdx].summon.forEach(smn => { // 重置召唤物
                    const { rOutStatus: rOst = [] } = newSummonee(smn.id).handle(smn, { reset: true });
                    rOutStatus.push(...rOst);
                })
                this.players[this.playerIdx].heros.forEach(h => {
                    [h.weaponSlot, h.talentSlot, h.artifactSlot].forEach(slot => { // 重置装备
                        if (slot != null) cardsTotal(slot.id)?.handle(slot, { reset: true });
                    });
                    h.inStatus.forEach(ist => heroStatus(ist.id).handle(ist, { reset: true })); // 重置角色状态
                    if (h.isFront) {
                        h.outStatus.forEach(ost => heroStatus(ost.id).handle(ost, { reset: true })); // 重置出战状态
                        if (rOutStatus.length > 0) h.outStatus = this._updateStatus(rOutStatus, h.outStatus).nstatus;
                    }
                });
                if (this.round == 1) { // 游戏开始时
                    for (let hi = 0; hi < 3; ++hi) {
                        this._doSkill5(hi, 'game-start');
                    }
                }
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    heros: this.players[this.playerIdx].heros,
                    site: this.players[this.playerIdx].site,
                    summonee: this.players[this.playerIdx].summon,
                    resetOnly: true,
                    flag: 'getServerInfo-phase-start-reset-' + this.playerIdx,
                });
                if (this.playerIdx == execIdx) {
                    await this._wait(() => this.isReseted, 10);
                    this._doSlot('phase-start', { pidx: startIdx, hidxs: allHidxs(players[startIdx].heros, { isAll: true }) });
                    await this._execTask(true);
                    this._doStatus(startIdx, [1, 4], 'phase-start', { intvl: [100, 500, 1000, 100] });
                    await this._execTask(true);
                    const { exchangeSite: ecs1 } = this._doSite(startIdx, 'phase-start', { intvl: [100, 500, 200, 100], firstPlayer: startIdx });
                    this.exchangeSite.push(...ecs1);
                    for (const [exsite, pidx] of ecs1) {
                        this.players[pidx].site.push(exsite);
                    }
                    await this._execTask(true);
                    this._doSlot('phase-start', { pidx: startIdx ^ 1, hidxs: allHidxs(players[startIdx ^ 1].heros, { isAll: true }) });
                    await this._execTask(true);
                    this._doStatus(startIdx ^ 1, [1, 4], 'phase-start', { intvl: [100, 500, 1000, 100] });
                    await this._execTask(true);
                    const { exchangeSite: ecs2 } = this._doSite(startIdx ^ 1, 'phase-start', { intvl: [100, 500, 200, 100], firstPlayer: startIdx });
                    this.exchangeSite.push(...ecs2);
                    for (const [exsite, pidx] of ecs2) {
                        this.players[pidx].site.push(exsite);
                    }
                    await this._execTask(true);
                    await this._delay(200);
                    for (const [exsite, pidx] of this.exchangeSite) {
                        this.players[pidx].site.push(exsite);
                    }
                    this.socket.emit('sendToServer', {
                        roundPhase: PHASE.ACTION,
                        sites: isCdt(this.exchangeSite.length > 0, this.players.map(p => p.site)),
                        flag: 'getServerInfo-phase-start-changePhase-' + execIdx,
                    });
                    this.exchangeSite = [];
                }
            }, 1000);
        }
        if (this.phase == PHASE.ACTION && phase == PHASE.ACTION_END && this.playerIdx == execIdx) { // 结束阶段
            this._sendTip('结束阶段', callback);
            setTimeout(async () => {
                this._doSlot('phase-end', { pidx: startIdx, hidxs: allHidxs(players[startIdx].heros, { isAll: true }) });
                await this._execTask(true);
                this._doStatus(startIdx, [1, 3, 9], 'phase-end', { intvl: [100, 500, 1000, 100] });
                await this._execTask(true);
                this._doSummon(startIdx, 'phase-end', { intvl: [100, 700, 2000, 200] });
                await this._execTask(true);
                this._doSite(startIdx, 'phase-end', { intvl: [100, 500, 200, 100] });
                await this._execTask(true);
                this._doSlot('phase-end', { pidx: startIdx ^ 1, hidxs: allHidxs(players[startIdx ^ 1].heros, { isAll: true }) });
                await this._execTask(true);
                this._doStatus(startIdx ^ 1, [1, 3, 9], 'phase-end', { intvl: [100, 500, 1000, 100] });
                await this._execTask(true);
                this._doSummon(startIdx ^ 1, 'phase-end', { intvl: [100, 700, 2000, 200] });
                await this._execTask(true);
                this._doSite(startIdx ^ 1, 'phase-end', { intvl: [100, 500, 200, 100] });
                await this._execTask(true);
                await this._delay(1100);
                this._wait(() => !this.taskQueue.isExecuting, 1100);
                if (this.taskQueue.hasStatusAtk() || this.isSwitchAtking) {
                    this.isSwitchAtking = true;
                    await this._wait(() => !this.isSwitchAtking, 2300);
                }
                if (this.players.every(p => p.heros.some(h => h.isFront))) {
                    this.players.forEach(p => {
                        p.heros.forEach((h, hi, a) => {
                            h.inStatus.forEach(ist => {
                                if (ist.roundCnt > 0) --ist.roundCnt;
                            });
                            h.outStatus.forEach(ost => {
                                if (ost.roundCnt > 0) --ost.roundCnt;
                            });
                            const { nstatus: nist, nheros: inh } = this._updateStatus([], h.inStatus, a, hi);
                            const { nstatus: nost, nheros: onh } = this._updateStatus([], h.outStatus, inh, hi);
                            if (onh) a[hi] = onh[hi];
                            a[hi].inStatus = nist;
                            a[hi].outStatus = nost;
                        });
                    });
                    this.socket.emit('sendToServer', {
                        roundPhase: PHASE.PHASE_END,
                        cpidx: this.playerIdx,
                        heros: this.players[this.playerIdx].heros,
                        eheros: this.players[this.playerIdx ^ 1].heros,
                        flag: 'getServerInfo-phase-end-changePhase-' + execIdx,
                    });
                }
            }, 1500);
        }
        setTimeout(() => {
            this.phase = phase;
            callback();
        }, phase == PHASE.DICE && this.round == 1 ? 1000 : 0);
        if (phase >= PHASE.CHANGE_CARD) this._calcSkillChange(1, players[this.playerIdx].hidx);
        this._clacCardChange();
        if (changeTo == this.playerIdx) { // 切换了角色
            this.isFall = true;
            const hidx = players[changeTo].hidx;
            const { inStatus } = this._doSkill5(hidx, 'change-to');
            this._doStatus(this.playerIdx, 11, 'change-from', { hidxs: [changeFrom], isOnlyInStatus: true });
            const heros = this.players[changeTo].heros;
            const { nheros: ncheros = [], nstatus } = this._updateStatus(heros[hidx].outStatus, [], heros, hidx);
            heros[hidx] = ncheros[hidx];
            heros[hidx].outStatus = [...nstatus];
            if (phase > PHASE.ACTION) {
                inStatus.forEach(ist => {
                    if (ist.roundCnt > 0) ++ist.roundCnt;
                });
                heros[hidx].inStatus = [...inStatus];
            }
            if (changeFrom != undefined) {
                const noheros = this._updateStatus([], ncheros[hidx].outStatus, ncheros, -1, changeFrom).nheros ?? [];
                heros[changeFrom] = noheros[changeFrom];
            }
            this.socket.emit('sendToServer', {
                cpidx: changeTo,
                heros,
                hidx,
                inStatus,
                site: this.players[changeTo].site,
                esummon: this.players[changeTo ^ 1].summon,
                isEndAtk: this.taskQueue.isTaskEmpty(),
                changeFrom,
                flag: 'getServerInfo-changeTo-' + this.playerIdx,
            });
        }
        if (this.playerIdx == heroDie) { // 击倒对方
            this._doSlot('kill', { pidx: heroDie ^ 1 });
        }
        this.log = [...log];
        if (elTips) this.elTips = [...elTips];
        if (dmgElements) this.dmgElements = [...dmgElements];
        if (willHeals) { // 回血
            this.willHeals = willHeals;
            this.isShowHeal = true;
            setTimeout(() => {
                this.isShowHeal = false;
                callback();
            }, 1800);
        }
        if (willDamage) { // 受伤
            this.willDamages = [...willDamage];
            if (isSendActionInfo) this.isShowDmg = true;
        }
        if (isSendActionInfo) this._sendActionInfo(callback, isSendActionInfo);
        if (dieChangeBack == PHASE.ACTION) { // 对方选完出战角色
            setTimeout(() => this._sendTip(this.player.status == 1 ? '继续你的回合' : '对方继续回合', callback), 1000);
        }
        if (dieChangeBack != undefined && this.playerIdx == cidx) { // 重新选择完出战角色
            setTimeout(async () => {
                this._doSlot('oppo-skill', { pidx: this.players.findIndex(p => p.status == 0), dieChangeBack: !!dieChangeBack });
                await this._execTask();
                if (dieChangeBack == PHASE.ACTION_END && this.taskQueue.isTaskEmpty()) {
                    this.socket.emit('sendToServer', {
                        roundPhase: PHASE.PHASE_END,
                        flag: 'getServerInfo-phase-dieChange-changePhase-' + this.playerIdx,
                    });
                }
            }, 10);
        }
        this.updatePlayerPositionInfo();
    }
    /**
     * 游戏开始时换卡
     * @param cidxs 要换的卡的索引数组
     */
    changeCard(cidxs: number[]) {
        this.socket.emit('sendToServer', { cpidx: this.playerIdx, cidxs, flag: 'changeCard-' + this.playerIdx });
    }
    /**
     * 选择出战角色
     * @param hidx 选择的角色的索引idx
     */
    chooseHero() {
        const hidx = this.player.heros.findIndex(h => h.isSelected > 0 || h.id == this.modalInfo.info?.id);
        if (this.player.phase == PHASE.CHOOSE_HERO) { // 选择初始出战角色
            this.selectHero(1, hidx);
        } else if ([PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase)) { // 阵亡选择角色
            this.isValid = true;
            this.changeHero();
        } else if (this.player.phase >= PHASE.ACTION_START && this.isShowChangeHero > 0) { // 准备切换角色
            this._calcHeroChangeDice(hidx, this.player.hidx);
            this.isValid = this.heroChangeDice == 0 || this.player.dice.length >= this.heroChangeDice;
            let isQuickAction = false;
            isQuickAction = this._doSkill5(this.player.hidx, 'change-from', { isExec: false }).isQuickAction;
            isQuickAction = this._doStatus(this.playerIdx, 4, 'change-from', { isQuickAction, isExec: false }).isQuickAction;
            isQuickAction = this._doSite(this.playerIdx, 'change', { isQuickAction, isExec: false }).isQuickAction;
            this.isShowChangeHero = 2;
            if (isQuickAction) this.isShowChangeHero = 3;
            if (!this.isValid) return;
            for (let i = this.player.dice.length - 1, cnt = this.heroChangeDice; i >= 0 && cnt > 0; --i, --cnt) {
                this.players[this.playerIdx].diceSelect[i] = true;
            }
            this.player.heros.forEach((h, hi) => {
                if (hi != this.player.hidx) {
                    if (hi == hidx) h.isSelected = 1;
                    else h.isSelected = 0;
                    h.canSelect = true;
                }
            });
            this.modalInfo = { ...this.NULL_MODAL };
            this.useSkill(-1, { isOnlyRead: true });
        }
    }
    /**
     * 选中角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     */
    selectHero(pidx: number, hidx: number, force = false) {
        this.cancel({ onlySiteAndSummon: true });
        if (this.currCard.canSelectHero == 0 || [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase) || force) {
            this.currCard = { ...this.NULL_CARD };
            const sidx = this.handCards.findIndex(c => c.selected);
            this.handCards.forEach(v => v.selected = false);
            if (this.isMobile && sidx > -1) this.mouseleave(sidx, true);
            this.modalInfo = {
                isShow: true,
                type: 4,
                info: this.players[this.playerIdx ^ pidx ^ 1].heros[hidx],
            };
        }
        if (!this.currCard.subType.includes(7) || this.currCard.canSelectHero == 0) {
            this.currSkill = { ...this.NULL_SKILL };
        }
        this.willSummons = [[], []];
        this.willAttachs = [[], [], [], [], [], []];
        if (this.player.phase == PHASE.CHOOSE_HERO && pidx == 1) { // 选择初始出战角色
            this.cancel({ onlyCard: true, notHeros: true });
            this.player.heros.forEach((h, idx) => {
                if (h.isSelected == 1 && idx == hidx) {
                    h.isFront = true;
                    h.isSelected = 0;
                    this.socket.emit('sendToServer', { cpidx: this.playerIdx, hidx, isChangeHero: true, flag: 'chooseHero-' + this.playerIdx });
                } else h.isSelected = idx == hidx ? 1 : 0;
            });
        } else {
            if (this.isShowChangeHero > 1 && pidx == 1 && this.player.heros[hidx].canSelect) {
                this.player.heros.forEach((h, hi) => {
                    if (hi == hidx) h.isSelected = 1;
                    else h.isSelected = 0;
                });
                this.players[this.playerIdx].diceSelect.forEach((_, i, a) => a[i] = false);
                this.chooseHero();
                this.modalInfo = { ...this.NULL_MODAL };
            } else {
                this.cancel({ onlyHeros: true });
                this.isShowChangeHero = (this.player.status == 1 || [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase)) &&
                    pidx == 1 && !this.player.heros[hidx].isFront && this.currCard.id <= 0 && this.player.heros[hidx].hp > 0 ? 1 : 0;
                this.isValid = true;
            }
            this._calcSkillChange(pidx, hidx, { isUpdateHandcards: false });
        }
    }
    /**
     * 选择卡需要的角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     * @returns 是否执行接下来的selectHero
     */
    selectCardHero(pidx: number, hidx: number, callback: () => void) {
        const heros = this.player.heros;
        if (this.phase != PHASE.ACTION || this.isShowChangeHero > 1) return true;
        const selectHero = heros[hidx];
        const { id, canSelectHero } = this.currCard;
        if (pidx == 0 || id <= 0 || !selectHero.canSelect) {
            this.cancel();
            return true;
        }
        if (selectHero.isSelected > 0) {
            heros.forEach(h => h.isSelected = 0);
        } else {
            const selected = heros.filter(h => h.isSelected > 0).length;
            if (selected >= canSelectHero) {
                heros.forEach((h, hi) => {
                    if (canSelectHero == 1) h.isSelected = hi == hidx ? 1 : 0;
                    else if (h.isSelected != 1) h.isSelected = hi == hidx ? 2 : 0;
                });
            } else {
                selectHero.isSelected = selected + 1;
            }
        }
        const { isValid } = this.checkCard(callback);
        this.isValid = isValid && heros.filter(h => h.isSelected > 0).length == canSelectHero;
        return false;
    }
    /**
     * 选择卡需要的召唤物
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 召唤物索引idx
     */
    selectCardSummon(pidx: number, suidx: number) {
        const curPlayer = this.players[this.playerIdx ^ pidx ^ 1];
        const selectSummon = curPlayer.summon[suidx];
        if (this.currCard.id <= 0 || !selectSummon?.canSelect) {
            this.cancel();
            return;
        }
        const newVal = !selectSummon.isSelected;
        selectSummon.isSelected = newVal;
        if (newVal) {
            curPlayer.summon.forEach((smn, i) => smn.isSelected = i == suidx);
        }
        const { isValid } = this.checkCard();
        this.isValid = isValid && [...this.player.summon, ...this.opponent.summon].some(smn => smn.isSelected);
    }
    /**
     * 选择卡需要的场地
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 场地索引idx
     */
    selectCardSite(siidx: number) {
        const curPlayer = this.players[this.playerIdx];
        if (curPlayer.site.every(s => !s.canSelect)) {
            this.cancel();
            return;
        }
        const selectSite = curPlayer.site[siidx];
        const newVal = !selectSite.isSelected;
        selectSite.isSelected = newVal;
        if (newVal) {
            curPlayer.site.forEach((site, i) => site.isSelected = i == siidx);
        }
        const { isValid } = this.checkCard();
        this.isValid = isValid && curPlayer.site.some(site => site.isSelected);
    }
    /**
     * 选择要消耗的骰子
     * @param dices 当前选择骰子的情况数组
     */
    selectUseDice(dices: boolean[]) {
        this.players[this.playerIdx].diceSelect = [...dices];
        if (this.currCard.id > 0) { // 选择卡所消耗的骰子
            const { cost, costType, anydice } = this.currCard;
            if (dices.filter(v => v).length < cost + anydice) return this.isValid = false;
            if (costType == 0) return this.isValid = true;
            const diceLen = this.player.dice.length;
            const diceCnt = new Array(8).fill(0);
            for (let i = 0; i < diceLen; ++i) {
                if (dices[i]) ++diceCnt[this.player.dice[i]];
            }
            const canSelect = this.currCard.canSelectHero == this.player.heros.filter(h => h.isSelected).length;
            if (costType < 8) {
                const elDiceValid = diceCnt[costType] + diceCnt[0] >= cost;
                const anyDiceValid = diceCnt.reduce((a, b) => a + b) - cost == anydice;
                return this.isValid = elDiceValid && anyDiceValid && canSelect;
            }
            const typeCnt = diceCnt.filter(v => v > 0).length;
            return this.isValid = !(typeCnt > 2 || (typeCnt == 2 && diceCnt[0] == 0)) && canSelect;
        }
        if (this.currSkill.type > 0) { // 选择技能所消耗的骰子
            const [elDice, anyDice] = this.currSkill.cost;
            const diceLen = this.player.dice.length;
            const diceCnt = new Array(8).fill(0);
            for (let i = 0; i < diceLen; ++i) {
                if (dices[i]) ++diceCnt[this.player.dice[i]];
            }
            if (elDice.color < 8) {
                const elDiceValid = diceCnt[elDice.color] + diceCnt[0] >= elDice.val;
                const anyDiceValid = diceCnt.reduce((a, b) => a + b) - elDice.val == anyDice.val;
                return this.isValid = elDiceValid && anyDiceValid;
            }
            const typeCnt = diceCnt.filter(v => v > 0).length;
            return this.isValid = !(typeCnt > 2 || (typeCnt == 2 && diceCnt[0] == 0));
        }
        if (this.isShowChangeHero > 0) { // 切换角色所消耗的骰子
            this.isValid = this.player.diceSelect.filter(v => v).length == this.heroChangeDice;
        }
    }
    /**
     * 调和骰子
     * @param bool 是否进行调和
     */
    reconcile(bool: boolean) {
        if (this.player.dice.every(v => [0, this.player.heros[this.player.hidx].element].includes(v))) return;
        if (bool) {
            if (!this.isReconcile) {
                this.isReconcile = true;
                const { isValid, diceSelect } = this.checkCard();
                this.player.heros.forEach(h => {
                    h.canSelect = false;
                    h.isSelected = 0;
                });
                this.isValid = isValid;
                this.players[this.playerIdx].diceSelect = diceSelect;
            } else {
                const dices = this.players[this.playerIdx].dice.map((d, i) => {
                    const val = this.players[this.playerIdx].diceSelect[i] ? this._getFrontHero().element : d;
                    return { val, isSelected: false };
                });
                const ndices = this.rollDice(dices);
                this.handCards = this.handCards.filter(card => !card.selected);
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    handCards: this.handCards,
                    currCard: this.currCard,
                    reconcile: true,
                    dices: ndices,
                    flag: 'reconcile-' + this.playerIdx,
                });
                this.cancel();
            }
        } else {
            this.isReconcile = bool;
        }
    }
    /**
     * 使用技能
     * @param sidx 选组技能的索引idx -1切换角色
     * @param options isOnlyRead 是否为只读, isCard 是否为使用卡, isSwitch 是否切换角色, isReadySkill 是否为准备技能
     * @param callback 上层updateInfo的回调函数
     */
    async useSkill(sidx: number, options: { isOnlyRead?: boolean, isCard?: boolean, isSwitch?: number, isReadySkill?: boolean }, callback?: () => void) {
        if ([PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.players[this.playerIdx ^ 1].phase)) return;
        const { isOnlyRead = false, isCard = false, isSwitch = -1, isReadySkill = false } = options;
        this.willSwitch = [false, false, false, false, false, false];
        const currSkill = { ...this.currSkill };
        const skill = isReadySkill ? readySkill(sidx, this.player.heros[this.player.hidx].element) :
            (isSwitch > -1 ? this._calcSkillChange(1, isSwitch, { isSwitch: true }) ?? [] : this.skills)[sidx];
        this.currSkill = { ...skill };
        if (sidx > -1 && (!this.currCard.subType.includes(7) || !isCard)) {
            this.currCard = { ...this.NULL_CARD };
            this.cancel({ onlyCard: true });
        }
        const curCard = { ...this.currCard };
        const curHandCards = clone(this.handCards);
        const isValid = this.isValid || isReadySkill;
        const isExec = !isOnlyRead && currSkill.name == skill?.name && isValid;
        let { heros: oeHeros, summon: oeSummon, hidx: eFrontIdx } = this.players[this.playerIdx ^ 1];
        const { heros: oaHeros, summon: oaSummon, hidx: ahidx } = this.players[this.playerIdx];
        const hidx = isSwitch > -1 ? isSwitch : ahidx;
        const curHandle = isReadySkill ? readySkill(sidx).handle : (skill?.rdskidx ?? -1) > -1 ?
            readySkill(skill.rdskidx).handle : herosTotal(oaHeros[hidx].id).skills.find(v => v.name === skill?.name)?.handle;
        let aHeros: Hero[] = clone(oaHeros);
        let aSummon: Summonee[] = clone(oaSummon);
        let eaHeros: Hero[] = clone(oeHeros);
        let esummon: Summonee[] = clone(oeSummon);
        let aOutStatusOppoPre: Status[] = clone(aHeros[ahidx].outStatus);
        let aInStatusOppoPre: Status[][] = aHeros.map(h => clone(h.inStatus));
        const willDamagesPre: number[][] = [[-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0]];
        const willAttachPre: number[][] = [[], [], [], [], [], []];
        const allHeros = this.players.flatMap(p => p.heros);
        const skillcmds: Cmds[] = [];
        const eskillcmds: Cmds[] = [];
        let switchAtkPre = 0;
        if (isSwitch > -1) {
            const { statusIdsAndPidx } = this._doStatus(this.playerIdx, 1, 'change-from', { isOnlyFront: true, isExec: false });
            switchAtkPre = statusIdsAndPidx.length;
            if (statusIdsAndPidx.length > 0 && !isExec) {
                for (let i = 0; i < switchAtkPre; ++i) {
                    const { id: stsId, type: stsType } = statusIdsAndPidx[i];
                    const sts = [aInStatusOppoPre[ahidx], aOutStatusOppoPre][stsType].find(sts => sts.id == stsId);
                    if (sts == undefined) throw new Error('status not found');
                    const stsres = heroStatus(stsId).handle(sts, {
                        heros: aHeros,
                        eheros: eaHeros,
                        trigger: 'change-from',
                        hidx,
                    });
                    const { willDamage: willDamage0, willAttachs: willAttachs0, eheros: eheros0,
                        summon: esummon0, aheros: aheros0, summonOppo: asummon0, elrcmds: elrcmds0
                    } = this._elementReaction(
                        stsres?.element ?? 0,
                        [0, 0, 0].map((_, i) => [
                            i == eFrontIdx ? (stsres?.damage ?? -1) : -1,
                            stsres?.hidxs?.includes(i) || (i != eFrontIdx && stsres?.hidxs == undefined) ? (stsres?.pendamage ?? 0) : 0
                        ]),
                        eFrontIdx,
                        eaHeros, esummon,
                        aHeros, aSummon,
                        { isExec, usedDice: skill.cost.reduce((a, b) => a + b.val, 0) }
                    );
                    willDamage0.forEach((dmg, di) => {
                        willDamagesPre[di + this.playerIdx * 3] = allHeros[di + (this.playerIdx ^ 1) * 3].hp > 0 ? [...dmg] : [-1, 0];
                    });
                    for (let i = 0; i < 3; ++i) willAttachPre[i + (this.playerIdx ^ 1) * 3].push(willAttachs0[i]);
                    eaHeros = [...eheros0];
                    aHeros = [...aheros0];
                    aSummon = [...asummon0];
                    esummon = [...esummon0];
                    skillcmds.push(...elrcmds0[0]);
                    eskillcmds.push(...elrcmds0[1]);
                }
                aOutStatusOppoPre = clone(aHeros[hidx].outStatus);
                aInStatusOppoPre = clone(aHeros.map(h => h.inStatus));
            }
            if (!isOnlyRead) {
                await this._delay(1100 + switchAtkPre * 3000);
                if (switchAtkPre > 0) {
                    this.isSwitchAtking = true;
                    await this._wait(() => switchAtkPre == 0 || !this.isSwitchAtking);
                }
                let { heros: oeHeros, summon: oeSummon } = this.opponent;
                const { heros: oaHeros, summon: oaSummon } = this.player;
                aHeros = clone(oaHeros);
                aSummon = clone(oaSummon);
                eaHeros = clone(oeHeros);
                esummon = clone(oeSummon);
                aOutStatusOppoPre = clone(aHeros[hidx].outStatus);
                aInStatusOppoPre = aHeros.map(h => clone(h.inStatus));
            }
        }
        let aElTips: [string, number, number][] = [];
        let dmgElements: number[] = [0, 0, 0];
        const aWillAttach: number[][] = clone(willAttachPre);
        const aWillDamages: number[][] = [[-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0]];
        const aWillHeal: number[] = [-1, -1, -1, -1, -1, -1];
        const statusIds: StatusTask[] = [];
        const bWillAttach: number[][] = aWillAttach;
        const bWillDamages: number[][][] = [aWillDamages];
        const bWillHeal: number[][] = [aWillHeal];
        const isChargedAtk = skill?.type == 1 && ((this.player.dice.length + (!isOnlyRead && isCard ? (skill?.cost[0].val ?? 0) + (skill?.cost[1].val ?? 0) : 0)) & 1) == 0;
        const isFallAtk = skill?.type == 1 && (this.isFall || isSwitch > -1);
        if (curCard.id > 0) this._doSlot('card', { hidxs: allHidxs(aHeros, { isAll: true }), hcard: curCard, heros: aHeros });
        const skillres = curHandle?.({
            hero: aHeros[hidx],
            heros: aHeros,
            eheros: eaHeros,
            skidx: sidx,
            card: curCard,
            hcards: curHandCards,
            summons: aSummon,
            isChargedAtk,
            isFallAtk,
            isReadySkill,
            isExec,
            windEl: eaHeros.find(h => h.isFront)?.attachElement?.find(el => el > 0 && el < 5),
        });
        if (isExec) skillres?.exec?.();
        if (skill) {
            if (skill.energyCost == 0) {
                aHeros[hidx].energy = Math.min(aHeros[hidx].maxEnergy, aHeros[hidx].energy + 1);
            } else if (skill.energyCost > 0) {
                aHeros[hidx].energy = 0;
            }
        }
        let aOutStatusPre: Status[] = clone(eaHeros[eFrontIdx].outStatus);
        let aInStatusPre: Status[][] = eaHeros.map(h => clone(h.inStatus));
        aOutStatusOppoPre = clone(aHeros[isExec ? hidx : ahidx].outStatus);
        aInStatusOppoPre = aHeros.map(h => clone(h.inStatus));
        const atriggers: Trigger[][] = [[], [], []];
        const etriggers: Trigger[][] = [[], [], []];
        if (sidx > -1) {
            this.isShowChangeHero = 0;
            let mds: number[][] = [];
            for (const curSkill of this.player.heros[this.player.hidx].skills) {
                if (curSkill.type == 4) continue;
                if (!curSkill) mds.push([0, 0]);
                else mds.push(curSkill.cost.toString().padStart(2, '0').split('').map(Number));
            }
            if (skillres?.atkAfter || skillres?.atkBefore) {
                const lhidx = allHidxs(this.opponent.heros);
                const offset = skillres?.atkAfter ? 1 : skillres?.atkBefore ? -1 : 0;
                eFrontIdx = lhidx[(lhidx.indexOf(eFrontIdx) + offset + lhidx.length) % lhidx.length];
            }
            if (skillres?.atkTo) eFrontIdx = skillres.atkTo;
            const willDamages = [0, 0, 0].map((_, i) => [
                i == eFrontIdx && skill.damage > 0 ? skill.damage + skill.dmgChange || -1 : -1,
                !skillres?.isOppo && (skillres?.hidxs?.includes(i) || (i != eFrontIdx && skillres?.hidxs == undefined)) ? (skillres?.pendamage ?? 0) : 0
            ]);
            aOutStatusPre = clone(eaHeros[eFrontIdx].outStatus);
            if ((skillres?.addDmgCdt ?? 0) > 0) {
                if (willDamages[eFrontIdx][0] < 0) willDamages[eFrontIdx][0] = skill.dmgChange;
                willDamages[eFrontIdx][0] += skillres.addDmgCdt;
            }
            if (skillres?.outStatusOppoPre) {
                const { nstatus: onsp, nheros: nhp } = this._updateStatus(skillres.outStatusOppoPre, aOutStatusOppoPre, aHeros);
                aOutStatusOppoPre = onsp;
                if (nhp) aHeros = nhp;
            }
            if (skillres?.inStatusOppoPre) {
                if (skillres?.hidxs) {
                    for (const shidx of skillres.hidxs) {
                        const { nstatus: insp, nheros: nhp } = this._updateStatus(skillres.inStatusOppoPre, aInStatusOppoPre[shidx], aHeros, shidx);
                        aInStatusOppoPre[shidx] = insp;
                        if (nhp) aHeros = nhp;
                    }
                } else {
                    const { nstatus: insp, nheros: nhp } = this._updateStatus(skillres.inStatusOppoPre, aInStatusOppoPre[hidx], aHeros, hidx);
                    aInStatusOppoPre[hidx] = insp;
                    if (nhp) aHeros = nhp;
                }
            }
            if (skillres?.outStatusPre) {
                const { nstatus: eonsp, nheros: nehp } = this._updateStatus(skillres.outStatusPre, aOutStatusPre, eaHeros);
                aOutStatusPre = eonsp;
                if (nehp) eaHeros = nehp;
            }
            if (skillres?.inStatusPre) {
                if (skillres?.hidxs) {
                    for (const shidx of skillres.hidxs) {
                        const { nstatus: einsp, nheros: nehp } = this._updateStatus(skillres.inStatusPre, aInStatusPre[shidx], eaHeros, shidx);
                        aInStatusPre[shidx] = einsp;
                        if (nehp) eaHeros = nehp;
                    }
                } else {
                    const { nstatus: einsp, nheros: nehp } = this._updateStatus(skillres.inStatusPre, aInStatusPre[eFrontIdx], eaHeros, eFrontIdx);
                    aInStatusPre[eFrontIdx] = einsp;
                    if (nehp) eaHeros = nehp;
                }
            }
            if (skillres?.summonPre) aSummon = this._updateSummon(skillres.summonPre, aSummon, aOutStatusOppoPre);
            aHeros.forEach((h, hi) => h.inStatus = [...aInStatusOppoPre[hi]]);
            aHeros[hidx].outStatus = [...aOutStatusOppoPre];
            eaHeros.forEach((h, hi) => h.inStatus = [...aInStatusPre[hi]]);
            eaHeros[eFrontIdx].outStatus = [...aOutStatusPre];
            const dmgEl = skillres?.dmgElement ?? (skill.attachElement || skill.dmgElement);
            const { willDamage: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1,
                eheros: eheros1, summon: esummon1, aheros: aheros1, summonOppo: asummon1, minusDiceSkill: mds1,
                elTips: elTips1, atriggers: atriggers1, etriggers: etriggers1, willheals: healres, elrcmds: elrcmds1,
            } = this._elementReaction(
                dmgEl,
                willDamages,
                eFrontIdx,
                eaHeros, esummon,
                aHeros, aSummon,
                {
                    isExec, skidx: sidx, sktype: skill.type, isChargedAtk, isFallAtk, isReadySkill,
                    usedDice: skill.cost.reduce((a, b) => a + b.val, 0), minusDiceSkill: mds,
                }
            );
            dmgElements = [...dmgElements1];
            eaHeros = [...eheros1];
            aHeros = [...aheros1];
            aElTips = [...elTips1];
            for (let i = 0; i < 3; ++i) aWillAttach[i + (this.playerIdx ^ 1) * 3].push(willAttachs1[i]);
            aSummon = [...asummon1];
            esummon = [...esummon1];
            atriggers1.forEach((at, ati) => atriggers[ati].push(...at));
            etriggers1.forEach((et, eti) => etriggers[eti].push(...et));
            if (mds1) mds = mds1;
            let aInStatusOppo: Status[][] = aHeros.map(h => clone(h.inStatus));
            aInStatusOppoPre = clone(aInStatusOppoPre);
            let aOutStatusOppo: Status[] = clone(aHeros[hidx].outStatus);
            aOutStatusOppoPre = clone(aOutStatusOppo);
            let aInStatus: Status[][] = eaHeros.map(h => clone(h.inStatus));
            aInStatusPre = clone(aInStatus);
            let aOutStatus: Status[] = clone(eaHeros[eFrontIdx].outStatus);
            aOutStatusPre = clone(aOutStatus);
            skillcmds.push(...elrcmds1[0]);
            eskillcmds.push(...elrcmds1[1]);
            willDamage1.forEach((dmg, di) => {
                aWillDamages[di + this.playerIdx * 3] = allHeros[di + (this.playerIdx ^ 1) * 3].hp > 0 ? [...dmg] : [-1, 0];
            });
            if (skillres?.pendamage && skillres?.isOppo) {
                skillres?.hidxs?.forEach((hi: number) => {
                    aWillDamages[hi + (this.playerIdx ^ 1) * 3][1] += skillres.pendamage;
                });
            }
            if (skillres?.heal) {
                const healHidxs = skillres?.hidxs ?? [hidx];
                this.player.heros.forEach((h, hi) => {
                    if (healHidxs.includes(hi)) {
                        const hidx = hi + (this.playerIdx ^ 1) * 3;
                        const hl = Math.min(h.maxhp - h.hp, skillres.heal);
                        if (aWillHeal[hidx] < 0) aWillHeal[hidx] = hl;
                        else aWillHeal[hidx] += hl;
                    }
                });
            }
            if (skillres?.summon) aSummon = this._updateSummon(skillres.summon, aSummon, aOutStatusOppo);
            const { nstatus: nstatusoppo1, nheros: nahero1 }
                = this._updateStatus([...(skillres?.inStatusOppo ?? [])], aInStatusOppo[hidx], aHeros, hidx);
            aInStatusOppo[hidx] = [...nstatusoppo1];
            if (nahero1) {
                aHeros = [...nahero1];
                aHeros[hidx].inStatus = [...nstatusoppo1];
            }
            const { nstatus: nstatusoppo2, nheros: nahero2 } = this._updateStatus([...(skillres?.outStatusOppo ?? [])], aOutStatusOppo, aHeros, hidx);
            aOutStatusOppo = [...nstatusoppo2];
            if (nahero2) {
                aHeros = [...nahero2];
                aHeros[hidx].outStatus = [...aOutStatusOppo];
            }
            if (skillres?.hidxs) {
                for (const shidx of skillres.hidxs) {
                    const { nstatus: nstatus1, nheros: nehero1 } = this._updateStatus(skillres?.inStatus ?? [], aInStatus[shidx], eaHeros, shidx);
                    aInStatus[shidx] = [...nstatus1];
                    if (nehero1) {
                        eaHeros = [...nehero1];
                        eaHeros[shidx].inStatus = [...nstatus1];
                    }
                }
            } else {
                const { nstatus: nstatus1, nheros: nehero1 } = this._updateStatus(skillres?.inStatus ?? [], aInStatus[eFrontIdx], eaHeros, eFrontIdx);
                aInStatus[eFrontIdx] = [...nstatus1];
                if (nehero1) {
                    eaHeros = [...nehero1];
                    eaHeros[eFrontIdx].inStatus = [...nstatus1];
                }
            }
            const { nstatus: nstatus2, nheros: nehero2 } = this._updateStatus(skillres?.outStatus ?? [], aOutStatus, eaHeros, eFrontIdx);
            aOutStatus = [...nstatus2];
            if (nehero2) {
                eaHeros = [...nehero2];
                eaHeros[eFrontIdx].outStatus = [...aOutStatus];
            }
            if (skillres?.isAttach) {
                const { eheros: aheros2, summon: asummon2, aheros: eheros2, elrcmds: elrcmds2, willAttachs: willAttachs2,
                    summonOppo: esummon2, elTips: elTips2, atriggers: etriggers2, etriggers: atriggers2,
                } = this._elementReaction(
                    skill.dmgElement,
                    [[-1, 0], [-1, 0], [-1, 0]],
                    hidx,
                    aHeros, aSummon,
                    eaHeros, esummon,
                    { isAttach: true, isExec, elTips: elTips1 },
                );
                aHeros = [...aheros2];
                eaHeros = [...eheros2];
                aInStatusOppo[hidx] = clone(aHeros[hidx].inStatus);
                aOutStatusOppo = clone(aHeros[hidx].outStatus);
                aInStatus[eFrontIdx] = clone(eaHeros[eFrontIdx].inStatus);
                aOutStatus = clone(eaHeros[eFrontIdx].outStatus);
                aSummon = [...asummon2];
                esummon = [...esummon2];
                skillcmds.push(...elrcmds2[0]);
                eskillcmds.push(...elrcmds2[1]);
                aElTips = [...elTips2];
                const atkhidx = getAtkHidx(eaHeros);
                atriggers[hidx] = [...new Set([...atriggers[hidx], ...atriggers2[hidx]])];
                etriggers[atkhidx] = [...new Set([...etriggers[atkhidx], ...etriggers2[atkhidx]])];
                for (let i = 0; i < 3; ++i) aWillAttach[i + this.playerIdx * 3].push(willAttachs2[i]);
            }
            if (skillres?.cmds) skillcmds.push(...skillres.cmds);

            const afterSkillTrgs = atriggers[hidx].filter(trg => trg.startsWith('skill')).map(v => 'after-' + v) as Trigger[];
            this._doSlot(afterSkillTrgs, { isExec, heros: aHeros });
            this._doStatus(this.playerIdx, 4, afterSkillTrgs, { isExec, isOnlyOutStatus: true, dmgElement: dmgEl, heros: aHeros });

            const { cmds: sitecmds, siteCnt } = this._doSite(this.playerIdx, atriggers[hidx], { intvl: [100, 500, 500, 100], isExec, isSkill: sidx, minusDiceSkill: mds });
            this.siteCnt[this.playerIdx] = siteCnt[this.playerIdx];
            skillcmds.push(...sitecmds);
            const { cmds: siteoppocmds, siteCnt: siteOppoCnt } = this._doSite(this.playerIdx ^ 1, [...new Set(etriggers.flat())], { intvl: [100, 500, 500, 100], isExec, isSkill: sidx });
            this.siteCnt[this.playerIdx ^ 1] = siteOppoCnt[this.playerIdx ^ 1];
            skillcmds.push(...siteoppocmds);
            const hndhp = (this.playerIdx == 0 ? [...eaHeros, ...aHeros] : [...aHeros, ...eaHeros]).map(h => h.maxhp - h.hp);
            for (let i = 0; i < 6; ++i) {
                if (healres[i] < 0) continue;
                if (aWillHeal[i] < 0) aWillHeal[i] = Math.min(hndhp[i], healres[i]);
                else aWillHeal[i] = aWillHeal[i] + Math.min(hndhp[i] - aWillHeal[i], healres[i]);
            }
        }

        let bHeros: Hero[][] = [clone(aHeros)];
        let ebHeros: Hero[][] = [clone(eaHeros)];
        let bSummon: Summonee[][] = [clone(aSummon)];
        let ebSummon: Summonee[][] = [clone(esummon)];
        aInStatusOppoPre = clone(aHeros.map(h => h.inStatus));
        aOutStatusOppoPre = clone(aHeros[hidx].outStatus);
        aInStatusPre = clone(eaHeros.map(h => h.inStatus));
        aOutStatusPre = clone(eaHeros[eFrontIdx].outStatus);
        if (isOnlyRead && switchAtkPre > 0) bWillDamages.unshift(clone(willDamagesPre));
        let isSwitchAtk = false;
        const isSwitchSelf = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && cmds.cmd?.includes('self'));
        const isSwitchOppo = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'));
        const calcAtk = (res: any, type: string, stsId: number, ahidx: number, ehidx: number, isOppo = false) => {
            if (res?.damage == undefined && res?.pendamage == undefined && res?.heal == undefined) return false;
            if (res?.damage == undefined && res?.pendamage == undefined) {
                const nheros = clone(isOppo ? (ebHeros.at(-1) ?? []) : (bHeros.at(-1) ?? []));
                const neheros = clone(isOppo ? (bHeros.at(-1) ?? []) : (ebHeros.at(-1) ?? []));
                nheros.forEach((h, hi) => {
                    if (h.hp > 0 && res.hidxs?.includes(hi)) {
                        h.hp = Math.min(h.maxhp, h.hp + res.heal);
                    }
                });
                bHeros.push(nheros);
                ebHeros.push(neheros);
                bSummon.push(isOppo ? (ebSummon.at(-1) ?? []) : (bSummon.at(-1) ?? []));
                ebSummon.push(isOppo ? (bSummon.at(-1) ?? []) : (ebSummon.at(-1) ?? []));
                return false;
            }
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = eFrontIdx;
            const willDamages = [0, 0, 0].map((_, i) => [
                i == (isOppo ? ahidx : ehidx) ? (res?.damage ?? -1) : -1,
                res?.hidxs?.includes(i) || (i != (isOppo ? ahidx : ehidx) && res?.hidxs == undefined) ? (res?.pendamage ?? 0) : 0
            ]);
            const { willDamage: willDamage3, willAttachs: willAttachs3, eheros: eheros3,
                summon: esummon3, aheros: aheros3, summonOppo: asummon3, elrcmds: elrcmds3,
            } = this._elementReaction(
                res.element,
                willDamages,
                isOppo ? ahidx : ehidx,
                isOppo ? (bHeros.at(-1) ?? []) : (ebHeros.at(-1) ?? []),
                isOppo ? (bSummon.at(-1) ?? []) : (ebSummon.at(-1) ?? []),
                isOppo ? (ebHeros.at(-1) ?? []) : (bHeros.at(-1) ?? []),
                isOppo ? (ebSummon.at(-1) ?? []) : (bSummon.at(-1) ?? []),
                { isExec: false }
            );
            const { isSwitch: csw = -1, isSwitchOppo: cswo = -1 } = this._doCmds(elrcmds3[0], { isExec: false });
            if (cswo == -1 && type == 'die') return true;
            let obj;
            if (type == 'summon') {
                obj = (isOppo ? esummon3 : asummon3).find(smnop => smnop.id == stsId);
                res?.exec?.({ summon: obj });
            } else {
                if (type == 'outStatus') obj = (isOppo ? eheros3[ehidx] : aheros3[ahidx]).outStatus.find(sts3 => sts3.id == stsId);
                else if (type == 'inStatus') obj = (isOppo ? eheros3[ehidx] : aheros3[ahidx]).inStatus.find(sts3 => sts3.id == stsId);
                res?.exec?.(obj, { heros: aheros3, eheros: eheros3 });
            }
            bHeros.push(isOppo ? eheros3 : aheros3);
            ebHeros.push(isOppo ? aheros3 : eheros3);
            bSummon.push([...(isOppo ? esummon3 : asummon3)]);
            ebSummon.push([...(isOppo ? asummon3 : esummon3)]);
            for (let i = 0; i < 3; ++i) bWillAttach[i + ((this.playerIdx ^ (isOppo ? 0 : 1))) * 3].push(willAttachs3[i]);
            if (this.playerIdx ^ (isOppo ? 0 : 1)) bWillDamages.push([...clone(willDamage3), [-1, 0], [-1, 0], [-1, 0]]);
            else bWillDamages.push([[-1, 0], [-1, 0], [-1, 0], ...clone(willDamage3)]);
            if (isOppo) {
                ahidx = cswo > -1 ? cswo : ahidx;
                ehidx = csw > -1 ? csw : ehidx;
            } else {
                ahidx = csw > -1 ? csw : ahidx;
                ehidx = cswo > -1 ? cswo : ehidx;
            }
            if (isSwitchOppo(elrcmds3[0])) {
                if (isOppo) {
                    const { statusIdsAndPidx } = this._doStatus(this.playerIdx, 1, 'change-from', { hidxs: [ahidx], isExec: false });
                    if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
                    doAfterStatus(aInStatusOppoPre[ahidx], 0, ['change-from'], ahidx, ehidx, 0, true);
                    doAfterStatus(aOutStatusOppoPre, 1, ['change-from'], ahidx, ehidx, 0, true);
                } else {
                    const { statusIdsAndPidx } = this._doStatus(this.playerIdx ^ 1, 1, 'change-from', { hidxs: [ehidx], isExec: false });
                    if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
                    doAfterStatus(aInStatusPre[ehidx], 0, ['change-from'], ahidx, ehidx, 1, true);
                    doAfterStatus(aOutStatusPre, 1, ['change-from'], ahidx, ehidx, 1, true);
                }
            }
            return false;
        }
        const doAfterStatus = (ostatus: Status[], stype: number, trgs: Trigger[], ahidx: number, ehidx: number, isOppo = 0, isAfterSwitch = false) => {
            const status = clone(ostatus);
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = eFrontIdx;
            for (const sts of status) {
                for (const state of trgs) {
                    const stsres = heroStatus(sts.id).handle(sts, {
                        heros: isOppo ? eaHeros : aHeros,
                        eheros: isOppo ? aHeros : eaHeros,
                        hidx: isOppo ? ehidx : ahidx,
                        trigger: state,
                        isChargedAtk: isOppo ? false : isChargedAtk,
                    });
                    const isOppoAtk = stsres?.isOppo ? 1 : 0;
                    if (this._hasNotTrigger(stsres.trigger, state)) continue;
                    if (sts.type.includes(1) && (stsres.damage || stsres.pendamage || stsres.heal)) {
                        statusIds.push({ id: sts.id, type: stype, pidx: (this.playerIdx ^ isOppoAtk ^ isOppo), isOppo: isOppoAtk, trigger: state, isAfterSwitch });
                        const dmg = [0, 0, 0, 0, 0, 0].map((_, di) => bWillDamages.reduce((a, b) => a + b[di][0] + b[di][1], 0));
                        const willKill = isOppo ? dmg[(this.playerIdx ^ 1) * 3 + ahidx] >= aHeros[ahidx].hp : dmg[this.playerIdx * 3 + ehidx] >= eaHeros[ehidx].hp;
                        if (calcAtk(stsres, willKill ? 'die' : (['in', 'out'][stype] + 'Status'), sts.id, ahidx, ehidx, !!(isOppoAtk ^ isOppo))) continue;
                        if (stsres?.heal) {
                            let willheals = [-1, -1, -1, -1, -1, -1];
                            const whidx = sidx > -1 ? isOppo ? ehidx : ahidx : this.player.heros.findIndex(h => h.isSelected);
                            (isOppo ? eaHeros : aHeros).forEach((h, hi) => {
                                if (stsres?.hidxs?.includes(hi) || (stsres.hidxs == undefined && hi == whidx)) {
                                    willheals[hi + (this.playerIdx ^ (isOppo ? 0 : 1)) * 3] = Math.min(h.maxhp - h.hp, stsres?.heal ?? -1);
                                }
                            });
                            bWillHeal.push(willheals);
                        }
                    }
                }
            }
        }
        const { ndices, heros: cmdh, isSwitch: swc = -1, isSwitchOppo: swco = -1 } = this._doCmds(skillcmds, { callback, heros: aHeros, isExec });
        const { ndices: edices, heros: ecmdh } = this._doCmds(eskillcmds, { callback, heros: eaHeros, pidx: this.playerIdx ^ 1, isExec });
        if (cmdh) aHeros = cmdh;
        if (ecmdh) eaHeros = ecmdh;
        const aswhidx = isSwitchSelf(skillcmds) ? swc : -1;
        const eswhidx = isSwitchOppo(skillcmds) ? swco : -1;
        if (sidx > -1) {
            const [afterASkillTrgs, afterESkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.map(trg => trg.startsWith('skill') ? 'after-' + trg : trg.startsWith('after-') ? trg.slice(6) : trg) as Trigger[]));
            aInStatusPre.forEach((ist, isti) => doAfterStatus(ist, 0, afterESkillTrgs[isti], aswhidx, eswhidx, 1));
            doAfterStatus(aOutStatusPre, 1, afterESkillTrgs[eFrontIdx], aswhidx, eswhidx, 1);
            doAfterStatus(aInStatusOppoPre[hidx], 0, afterASkillTrgs[hidx], aswhidx, eswhidx);
            doAfterStatus(aOutStatusOppoPre, 1, afterASkillTrgs[hidx], aswhidx, eswhidx);
            for (const smn of clone(this.player.summon)) {
                ([`after-skilltype${skill.type}`, `after-skill`] as Trigger[]).forEach(trg => {
                    const smnres = newSummonee(smn.id).handle(smn, { heros: bHeros.at(-1) ?? [], trigger: trg, hcard: curCard });
                    if (smnres?.trigger?.includes(trg)) calcAtk(smnres, 'summon', smn.id, aswhidx, eswhidx);
                });
            }
        }
        if (isSwitchOppo(skillcmds)) {
            const { statusIdsAndPidx } = this._doStatus(this.playerIdx ^ 1, 1, 'change-from', { hidxs: [eFrontIdx], isExec: false, heros: eaHeros });
            if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
            doAfterStatus(aInStatusPre[eFrontIdx], 0, ['change-from'], aswhidx, eswhidx, 1, true);
            doAfterStatus(aOutStatusPre, 1, ['change-from'], aswhidx, eswhidx, 1, true);
        }
        if (sidx == -1 || isSwitchSelf(skillcmds)) {
            const { statusIdsAndPidx } = this._doStatus(this.playerIdx, 1, 'change-from', { hidxs: [hidx], isExec: false, heros: aHeros });
            if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
            doAfterStatus(aInStatusOppoPre[ahidx], 0, ['change-from'], aswhidx, eswhidx, 0, true);
            doAfterStatus(aOutStatusOppoPre, 1, ['change-from'], aswhidx, eswhidx, 0, true);
        }
        if (!isExec) {
            this.willHp = [0, 0, 0, 0, 0, 0].map((_, i) => {
                const allHeal = bWillHeal.reduce((a, b) => a + Math.max(0, b[i]), 0);
                const alldamage = bWillDamages.reduce((a, b) => a + Math.max(0, b[i][0]) + Math.max(0, b[i][1]), 0);
                const hasVal = bWillDamages.some(v => v[i][0] >= 0 || v[i][1] > 0) || bWillHeal.some(v => v[i] > 0);
                if (!hasVal) {
                    if (bWillHeal.some(v => v[i] == 0)) return 100;
                    return undefined;
                }
                const res = allHeal - alldamage;
                const hero = this.players[Math.floor(i / 3) ^ 1].heros[i % 3]
                const isRevive = hero.inStatus.find(ist => ist.type.includes(13));
                if (res + hero.hp <= 0 && !!isRevive) {
                    return (heroStatus(isRevive.id).handle(isRevive)?.cmds?.find(v => v.cmd == 'revive')?.cnt ?? 0) - hero.hp - 0.3;
                }
                return res;
            });
        }
        this.willAttachs = isExec ? [[], [], [], [], [], []] : bWillAttach.map(hwa => hwa.filter(wa => wa > 0));
        if (!isExec) {
            this.willSummons = [
                (ebSummon.at(-1) ?? []).filter(wsmn => !this.opponent.summon.map(smn => smn.id).includes(wsmn.id))
                    .map(wsmn => ({ ...wsmn, isWill: true })),
                (bSummon.at(-1) ?? []).filter(wsmn => !this.player.summon.map(smn => smn.id).includes(wsmn.id))
                    .map(wsmn => {
                        if ([3016, 3017, 3018].includes(wsmn.id)) return { ...newSummonee(3016), isWill: true };
                        return { ...wsmn, isWill: true };
                    })
            ];
        }
        this.summonCnt = this.summonCnt.map((smns, pi) => {
            const osmn = (pi == this.playerIdx ? this.player : this.opponent).summon;
            return smns.map((_, si) => {
                if (osmn.length - 1 < si) return 0;
                const smnCnt = (pi == this.playerIdx ? aSummon : esummon).find(smn => smn.id == osmn[si].id)?.useCnt ?? 0;
                return smnCnt - osmn[si].useCnt;
            });
        });
        if (sidx == -1) return;

        if (!isOnlyRead && currSkill.name == skill.name || isReadySkill) {
            if (!isValid) return this._sendTip('骰子不符合要求', callback ?? (() => { }));
            this.canAction = false;
            this.isFall = false;
            this.modalInfo = { ...this.NULL_MODAL };
            this.players[this.playerIdx].heros = aHeros;
            this.players[this.playerIdx ^ 1].heros = eaHeros;
            const heal = aWillHeal.slice(3 - this.playerIdx * 3, 6 - this.playerIdx * 3).map(v => Math.max(0, v) % 100);
            if (heal.some(hl => hl > 0)) {
                this._doSlot('heal', { hidxs: allHidxs(aHeros, { isAll: true }), heal });
                this._doStatus(this.playerIdx, 4, 'heal', { heal });
            }
            this.taskQueue.addStatusId(statusIds);
            this.socket.emit('sendToServer', {
                dices: ndices,
                edices,
                currSkill: skill,
                handCards: skillres?.handCards?.filter((c: Card) => !c.selected),
                heros: aHeros,
                eheros: eaHeros,
                summonee: aSummon,
                esummon,
                tarhidx: hidx,
                etarhidx: eFrontIdx,
                elTips: aElTips,
                willDamage: isCdt(skill.damage > 0 || aWillDamages.some(d => d[0] > 0), aWillDamages),
                willAttachs: aWillAttach,
                dmgElements,
                willHeals: isCdt(aWillHeal.some(v => v > -1), aWillHeal),
                skillcmds: [skillcmds, eskillcmds],
                site: this.players[this.playerIdx].site,
                playerInfo: this.players[this.playerIdx].playerInfo,
                isEndAtk: ebHeros.length == 1 && !isSwitchAtk && this.taskQueue.isTaskEmpty(),
                flag: `useSkill-${skill.name}-${this.playerIdx}`,
            });
            if (!curCard.subType.includes(7) || !isCard) this.cancel();
            return;
        }
        if (!isCard) {
            if (!isOnlyRead) {
                this.players[this.playerIdx].diceSelect = [...this.checkSkill(sidx, isSwitch)];
                this.isValid = true;
            } else {
                this.players[this.playerIdx].diceSelect = this.player.dice.map(() => false);
            }
        }
        if (curCard.id <= 0) {
            this.modalInfo = {
                isShow: true,
                type: sidx,
                info: this._getFrontHero(),
            };
        }
    }
    /**
     * 检查选择技能的骰子是否合法
     * @param sidx 技能索引idx
     * @param isSwitch 是否切换角色
     * @returns 选择骰子情况的数组
     */
    checkSkill(sidx: number, isSwitch: number = -1) {
        const skill = (isSwitch > -1 ? this._calcSkillChange(1, isSwitch, { isSwitch: true }) ?? [] : this.skills)[sidx];
        let anyDiceCnt = skill.cost[1].val - skill.costChange[1];
        let { val: elementDiceCnt, color: costType } = skill.cost[0];
        elementDiceCnt -= skill.costChange[0];
        const diceSelect = [];
        const diceLen = this.player.dice.length;
        if (costType == 8) {
            let maxidx = -1;
            const frontIdx = this._getFrontHero().element;
            const diceCnt: number[] = new Array(8).fill(0);
            this.player.dice.forEach(d => ++diceCnt[d]);
            for (let i = diceLen - 1, max = 0; i >= 0; --i) {
                const idx = this.player.dice[i];
                if (idx == 0) break;
                const cnt = diceCnt[idx];
                if (cnt >= elementDiceCnt) {
                    if (idx == frontIdx && maxidx > -1 && max + diceCnt[0] >= elementDiceCnt) break;
                    maxidx = idx;
                    break;
                }
                if (cnt > max && (diceCnt[frontIdx] <= cnt || elementDiceCnt - cnt <= diceCnt[frontIdx])) {
                    max = cnt;
                    maxidx = idx;
                }
            }
            for (let i = diceLen - 1, tmpcnt = elementDiceCnt; i >= 0; --i) {
                const idx = this.player.dice[i];
                if (idx != maxidx && idx > 0) diceSelect.unshift(false);
                else diceSelect.unshift(tmpcnt-- > 0);
            }
        } else {
            for (let i = diceLen - 1; i >= 0; --i) {
                const curType = this.player.dice[i];
                if (anyDiceCnt-- > 0) diceSelect.unshift(true);
                else if (costType == curType && elementDiceCnt > 0) {
                    diceSelect.unshift(true);
                    --elementDiceCnt;
                } else diceSelect.unshift(curType == 0 && elementDiceCnt-- > 0);
            }
        }
        return diceSelect;
    }
    /**
     * 切换角色
     */
    changeHero() {
        const hidx = this.player.heros.findIndex(h => h.isSelected > 0 || h.id == this.modalInfo.info?.id);
        if (this.player.phase == PHASE.CHOOSE_HERO) {
            this.chooseHero();
            this.cancel();
            return;
        }
        if (!this.isValid) return;
        this.cancel({ onlyHeros: true });
        const newDices = this.rollDice(this.player.dice.filter((_, i) => !this.player.diceSelect[i]).map(v => ({ val: v, isSelected: false })), { frontIdx: hidx });
        const dieChangeBack = [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase);
        let isQuickAction = false;
        let stsIsEndAtk = true;
        let outStatus: Status[] = [];
        const cmds: Cmds[] = [];
        if (dieChangeBack) {
            const { isEndAtk } = this._doSlot('kill', {
                pidx: this.playerIdx ^ 1,
                heros: this.players[this.playerIdx ^ 1].heros,
                isExec: false,
            });
            stsIsEndAtk &&= isEndAtk;
            const { isQuickAction: iqa } = this._doStatus(this.playerIdx ^ 1, 4, 'kill', { intvl: [100, 100, 100, 100], isOnlyFront: true });
            stsIsEndAtk &&= !iqa;
            const { cmds } = this._doStatus(this.playerIdx, 4, 'killed', { hidxs: [this.player.hidx], hidx });
            const { heros } = this._doCmds(cmds);
            if (heros) this.players[this.playerIdx].heros = heros;
        } else {
            let changeHeroDiceCnt = this._calcHeroChangeDice(hidx, this.player.hidx, true);
            isQuickAction = this._doSkill5(this.player.hidx, 'change-from').isQuickAction;
            changeHeroDiceCnt = this._doSlot('change', { hidxs: this.player.hidx, changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            const { isQuickAction: stsiqa, changeHeroDiceCnt: stschd } = this._doStatus(this.playerIdx, 4, 'change-from', { isQuickAction, changeHeroDiceCnt, isOnlyFront: true });
            isQuickAction = stsiqa;
            changeHeroDiceCnt = stschd;
            changeHeroDiceCnt = this._doSlot(['change'], { hidxs: [1, 2].map(v => (this.player.hidx + v) % 3), changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            changeHeroDiceCnt = this._doSlot(['change-to'], { hidxs: hidx, changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            const { cmds: sitecmd, outStatus: siteost, isQuickAction: stiqa } = this._doSite(this.playerIdx, 'change', { isQuickAction, changeHeroDiceCnt, hidx });
            isQuickAction = stiqa;
            cmds.push(...sitecmd);
            outStatus.push(...siteost);
        }
        this._doStatus(this.playerIdx, 1, 'change-from', { hidxs: [this.player.hidx], isQuickAction: isCdt(isQuickAction, 2) });
        this.players[this.playerIdx].heros[this.player.hidx].outStatus = this._updateStatus(outStatus, this.players[this.playerIdx].heros[this.player.hidx].outStatus).nstatus;
        const { heros } = this._doCmds(cmds);
        if (heros) this.players[this.playerIdx].heros = heros;
        this.socket.emit('sendToServer', {
            hidx,
            cpidx: this.playerIdx,
            isChangeHero: true,
            dices: isCdt(!dieChangeBack, newDices),
            heros: this.players[this.playerIdx].heros,
            eheros: this.players[this.playerIdx ^ 1].heros,
            site: this.players[this.playerIdx].site,
            cmds,
            dieChangeBack,
            isQuickAction,
            isEndAtk: this.taskQueue.isTaskEmpty() && stsIsEndAtk,
            flag: 'changeHero-' + this.playerIdx,
        });
        this.cancel();
    }
    /**
     * 投骰子
     * @param dices 骰子具体情况的数组
     * @param isDone 是否结束重投
     * @param options 投骰子的玩家idx, frontIdx 出战角色idx(重新排序，不会增加骰子，不会重投)
     * @returns val:骰子数组, isDone:是否结束重投
     */
    rollDice(dices?: DiceVO[], options: { pidx?: number, frontIdx?: number, isExec?: boolean } = {}) {
        const { pidx = this.playerIdx, frontIdx, isExec = true } = options;
        const tmpDice: [number, number][] = new Array(8).fill(0).map((_, i) => [i, 0]);
        const scnt = dices?.filter(d => !d.isSelected).length ?? 0;
        let diceLen = 8;
        // let diceLen = 14; // 骰子测试
        const player = this.players[pidx];
        if (dices != undefined) {
            dices.forEach(d => {
                if (!d.isSelected) ++tmpDice[d.val][1];
            });
            diceLen = frontIdx != undefined ? dices.length : player.dice.length;
        } else if (player.dice.length > 0) {
            return;
        }
        if (dices == undefined) {
            player.heros.forEach((h, hi) => {
                [h.artifactSlot, h.talentSlot, h.weaponSlot].forEach(slot => {
                    if (slot != null) {
                        const slotres = cardsTotal(slot.id).handle(slot, { heros: player.heros, hidxs: [hi], trigger: 'phase-dice' });
                        if (slotres?.trigger?.includes('phase-dice')) {
                            const { element = 0, cnt = 0 } = slotres;
                            tmpDice[element][1] += cnt;
                            diceLen -= cnt;
                        }
                    }
                });
            });
            player.site.forEach(site => {
                const siteres = newSite(site.id, site.card.id).handle(site);
                if (siteres?.trigger?.includes('phase-dice')) {
                    let { element = 0, cnt = 0, addRollCnt = 0 } = siteres;
                    if (element == -2) element = this._getFrontHero(pidx != this.playerIdx).element;
                    tmpDice[element][1] += cnt;
                    diceLen -= cnt;
                    this.rollCnt += addRollCnt;
                }
            });
        }
        const isDone = dices != undefined && --this.rollCnt == 0;
        if (isDone) this.showRerollBtn = false;
        for (let i = 0; i < diceLen - scnt; ++i) {
            // ++tmpDice[Math.floor(Math.random() * 8)][1];
            ++tmpDice[0][1]; // 骰子测试
        }
        const heroEle = [...player.heros]
            .sort((a, b) => {
                if (frontIdx == undefined) return Number(!a.isFront) - Number(!b.isFront);
                const weight = (h: Hero) => Number(player.heros.findIndex(v => v.id == h.id) != frontIdx);
                return weight(a) - weight(b);
            }).map(h => h.element);
        const pdice: number[] = [];
        while (tmpDice[0][1]-- > 0) pdice.push(0);
        for (let i = 0; i < 3; ++i) {
            while (tmpDice[heroEle[i]][1]-- > 0) {
                pdice.push(heroEle[i]);
            }
        }
        const restDice = tmpDice.filter(v => v[1] > 0).sort((a, b) => b[1] - a[1]);
        for (const idx in restDice) {
            while (restDice[idx][1]-- > 0) {
                pdice.push(Number(restDice[idx][0]));
            }
        }
        if (isExec) player.dice = [...pdice];
        this.updatePlayerPositionInfo();
        if (frontIdx == undefined) this.modalInfo = { ...this.NULL_MODAL };
        return { val: pdice, isDone };
    }
    /**
     * 重投骰子
     * @param dices dices 骰子具体情况的数组
     */
    reroll(dices: DiceVO[]) {
        this.socket.emit('sendToServer', { cpidx: this.playerIdx, dices: this.rollDice(dices), flag: 'reroll-' + this.playerIdx });
    }
    /**
     * 展示召唤物信息
     * @param pidx 玩家idx
     * @param suidx 召唤物idx
     */
    showSummonInfo(pidx: number, suidx: number) {
        if (this.currCard.canSelectSummon > -1 || this.currCard.canSelectSite > -1) return;
        this.cancel();
        const summons = [this.opponent.summon, this.player.summon];
        this.modalInfo = {
            isShow: true,
            type: 6,
            info: summons[pidx][suidx],
        }
    }
    /**
     * 展示场地信息
     * @param pidx 玩家idx
     * @param siidx 场地idx
     */
    showSiteInfo(pidx: number, siidx: number) {
        if (!this.players[this.playerIdx].site.some(s => s.canSelect) || pidx == 0) this.cancel();
        const sites = [this.opponent.site, this.player.site];
        this.modalInfo = {
            isShow: true,
            type: 5,
            info: sites[pidx][siidx].card,
        }
    }
    /**
     * 结束回合
     */
    endPhase() {
        if (this.player.status == 0 || !this.canAction || this.phase > PHASE.ACTION) return;
        this._doStatus(this.playerIdx, 4, ['end-phase', 'any-end-phase'], { intvl: [100, 500, 500, 200], phase: PHASE.ACTION_END });
        this._doStatus(this.playerIdx ^ 1, 4, 'any-end-phase', { intvl: [100, 500, 500, 200], phase: PHASE.ACTION_END });
        this._doSummon(this.playerIdx, 'end-phase', { intvl: [100, 700, 2000, 200], isUnshift: true });
        this._execTask();
        this.socket.emit('sendToServer', {
            endPhase: true,
            heros: this.players[this.playerIdx].heros,
            eheros: this.players[this.playerIdx ^ 1].heros,
            isEndAtk: this.taskQueue.isTaskEmpty(),
            flag: 'endPhase-' + this.playerIdx
        });
        this.cancel();
    }
    /**
     * 发出提示
     * @param content 提示内容
     * @param callback 上层updateInfo回调函数
     * @param top 距离top的距离(默认: 50%)
     * @param color 字体颜色(默认: black)
     * @param time 提示持续时间(默认: 1200)
     */
    _sendTip(content: string, callback: () => void, top?: string, color?: string, time?: number) {
        this.tip.content = content;
        if (top) this.tip.top = top;
        if (color) this.tip.color = color;
        setTimeout(() => {
            this.tip = { content: '' };
            this.cancel();
            callback();
        }, time ?? 1200);
    }
    /**
     * 发送当前行动信息
     * @param callback 上层updateInfo回调函数
     */
    _sendActionInfo(callback: () => void, time = 2000) {
        this.actionInfo = this.log.at(-1) || '';
        setTimeout(() => {
            this.actionInfo = '';
            this.isShowDmg = false;
            this.currSkill = { ...this.NULL_SKILL };
            this.elTips = [['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0]];
            this.cancel();
            callback();
        }, time);
    }
    /**
     * 获取当前出战角色信息
     * @param isOppo 是否获取的是对方的角色
     * @returns 当前出战角色信息
     */
    _getFrontHero(isOppo = false): Hero {
        const player = this.players[this.playerIdx ^ (isOppo ? 1 : 0)];
        return player.heros[player.hidx];
    }
    /**
     * 更细状态
     * @param nStatus 新状态
     * @param oStatus 原状态
     * @param heros 角色数组，用于改变附魔状态
     * @param hidx 附魔角色idx
     * @returns 合并后状态
     */
    _updateStatus(nStatus: Status[], oStatus: Status[], heros?: Hero[], hidx: number = -1, ohidx: number = -1) {
        const oriStatus: Status[] = clone(oStatus);
        const newStatus: Status[] = clone(nStatus);
        const nheros: Hero[] | undefined = clone(heros);
        const updateAttachEl = (aheros: Hero[], ahidx: number, stype: number, sts?: Status[]) => {
            const hero = aheros[ahidx];
            const attachElSts = [
                ...((stype == 0 && sts ? sts : hero.inStatus).filter(ist => ist.type.includes(8) && (ist.useCnt > 0 || ist.roundCnt > 0))),
                ...((stype == 1 && sts ? sts : hero.outStatus).filter(ost => ost.type.includes(8) && (ost.useCnt > 0 || ost.roundCnt > 0))),
            ][0];
            const attachEl = attachElSts == undefined ? 0 : heroStatus(attachElSts.id).handle(attachElSts, { heros: aheros, hidx: ahidx }).attachEl ?? 0;
            for (const skill of hero.skills) {
                if (skill.type == 4 || skill.dmgElement > 0 || skill.attachElement == attachEl) continue;
                skill.description = skill.description.replace(ELEMENT[skill.attachElement], ELEMENT[attachEl]);
                skill.attachElement = attachEl;
            }
        }
        newStatus.forEach(sts => {
            const cstIdx = oriStatus.findIndex(cst => cst.id == sts.id);
            if (cstIdx > -1) {
                if (sts.maxCnt == 0) {
                    oriStatus[cstIdx] = clone(sts);
                } else {
                    const cStatus = oriStatus[cstIdx];
                    cStatus.maxCnt = sts.maxCnt;
                    cStatus.perCnt = sts.perCnt;
                    if (cStatus.roundCnt > -1) {
                        cStatus.roundCnt = Math.max(-1, Math.min(cStatus.maxCnt, cStatus.roundCnt + sts.addCnt));
                    } else cStatus.roundCnt = sts.roundCnt;
                    if (cStatus.useCnt > -1) {
                        cStatus.useCnt = Math.max(-1, Math.min(cStatus.maxCnt, cStatus.useCnt + sts.addCnt));
                    } else cStatus.useCnt = sts.useCnt;
                }
            } else {
                oriStatus.push(sts);
            }
            if (nheros) {
                const stsres = heroStatus(sts.id).handle(sts, { heros: nheros, hidx });
                if (hidx > -1) {
                    if (sts.type.includes(8)) updateAttachEl(nheros, hidx, sts.group, oriStatus);
                    if (stsres?.onlyOne) {
                        nheros.some((h, hi) => {
                            if (hi == hidx) return false;
                            const idx = h.inStatus.findIndex(ist => ist.id == sts.id);
                            if (idx > -1) h.inStatus.splice(idx, 1);
                            return idx > -1;
                        });
                    }
                }
            }
        });
        const chidx = ohidx > -1 ? ohidx : hidx;
        oriStatus.forEach(sts => {
            if (sts.type.includes(8)) {
                const stsres = heroStatus(sts.id).handle(sts, { heros: nheros, hidx: chidx });
                if (stsres?.isUpdateAttachEl && nheros) updateAttachEl(nheros, chidx, sts.group);
            }
            if (ohidx > -1 || (sts.useCnt == 0 || sts.roundCnt == 0) && !sts.type.some(t => [9, 15].includes(t))) {
                if (sts.type.includes(8) && nheros) updateAttachEl(nheros, chidx, sts.group);
            }
        });
        return {
            nstatus: oriStatus.sort((a, b) => Math.sign(a.summonId) - Math.sign(b.summonId))
                .filter(sts => (sts.useCnt != 0 && sts.roundCnt != 0) || sts.type.some(t => [9, 15].includes(t))),
            nheros,
        };
    }
    /**
     * 更新召唤物
     * @param nSummon 新召唤物
     * @param oSummon 原召唤物
     * @param outStatus 阵营状态
     * @param options isSummon 是否是召唤物生成的新召唤物, trigger 触发时机
     * @returns 合并后召唤物
     */
    _updateSummon(nSummon: Summonee[], oSummon: Summonee[], outStatus: Status[],
        options: { isSummon?: number, trigger?: Trigger } = {}) {
        const oriSummon: Summonee[] = clone(oSummon);
        const newSummon: Summonee[] = clone(nSummon);
        const { isSummon = -1, trigger = '' } = options;
        newSummon.forEach(smn => {
            const csmnIdx = oriSummon.findIndex(osm => osm.id == smn.id);
            if (csmnIdx > -1) {
                oriSummon[csmnIdx].useCnt = Math.max(oriSummon[csmnIdx].useCnt, Math.min(oriSummon[csmnIdx].maxUse, oriSummon[csmnIdx].useCnt + smn.useCnt));
            } else if (oriSummon.length < 4) {
                oriSummon.push(smn);
                const smnres = newSummonee(smn.id).handle(smn, { reset: true });
                if (smnres?.rOutStatus) {
                    const nsts = this._updateStatus(smnres.rOutStatus, outStatus).nstatus;
                    outStatus.length = 0;
                    outStatus.push(...nsts);
                }
            }
        });
        if (isSummon > -1) return oriSummon;
        return oriSummon.filter(smn => {
            if (smn.statusId > 0 && smn.useCnt > 0) {
                let smnStatus = outStatus.find(ost => ost.id == smn.statusId);
                if (smnStatus == undefined) {
                    smnStatus = heroStatus(smn.statusId, smn.id);
                    const nsts = this._updateStatus([smnStatus], outStatus).nstatus;
                    outStatus.length = 0;
                    outStatus.push(...nsts);
                }
                if (smnStatus.useCnt != smn.useCnt) {
                    smnStatus.useCnt = smn.useCnt;
                }
            }
            if (smn.useCnt == 0 && (smn.isDestroy == 0 || smn.isDestroy == 1 && trigger == 'phase-end') ||
                smn.isDestroy == 2 && trigger == 'phase-end'
            ) {
                const ostIdx = outStatus.findIndex(ost => ost.summonId == smn.id) ?? -1;
                if (ostIdx > -1) outStatus.splice(ostIdx, 1);
                return false;
            }
            return true;
        });
    }
    /**
     * 元素反应
     * @param willAttach 前台角色将要附着的元素
     * @param willDamage 所有角色将要收到的伤害
     * @param frontIdx 受击角色索引idx
     * @param eheros 受击玩家角色数组
     * @param summon 受击方召唤物
     * @param aheros 攻击玩家角色数组
     * @param summonOppo 攻击方召唤物
     * @param options isAttach 是否为自己附着元素, isSummon 召唤物攻击id, pidx 发起攻击的玩家idx, isExec 是否执行
     *                isChargedAtk 是否为重击, isWind 是否为扩散伤害, isFallAtk 是否为下落攻击, isReadySkill 是否为准备技能, willheals 回血,
     *                elrcmds 命令执行, atriggers 攻击者触发时机, etriggers 受击者触发时机, sidx 技能idx, sktype 技能类型, isWindExec 扩散伤害是否执行,
     *                usedDice 使用的骰子, dmgElements: 本次伤害元素, minusDiceSkill 使用技能减骰子
     * @param willAttachs 所有角色将要附着的元素
     * @param elTips 元素反应提示 
     * @returns willDamage: 所有角色将要受到的伤害[普攻伤害, 穿透伤害], 
     *          willAttachs: 将要附着的元素, 
     *          dmgElements: 本次伤害元素,
     *          summon: 受击玩家召唤物,
     *          eheros: 受击玩家角色数组,
     *          summonOppo: 攻击玩家召唤物, 
     *          aheros: 攻击玩家角色数组, 
     *          elTips 元素反应提示 
     *          atriggers 攻击者触发时机
     *          etriggers 受击者触发时机
     *          willheals 回血组
     *          elrcmds 命令执行
     *          minusDiceSkill: 用技能减骰子
     */
    _elementReaction(
        willAttach: number, willDamage: number[][], frontIdx: number, eheros: Hero[],
        summon: Summonee[], aheros: Hero[], summonOppo: Summonee[],
        options: {
            isAttach?: boolean, isSummon?: number, pidx?: number, isExec?: boolean, isChargedAtk?: boolean, isWind?: boolean,
            skidx?: number, sktype?: number, isFallAtk?: boolean, isReadySkill?: boolean, isWindExec?: boolean, willheals?: number[],
            elrcmds?: Cmds[][], atriggers?: Trigger[][], etriggers?: Trigger[][], usedDice?: number, dmgElements?: number[],
            minusDiceSkill?: number[][], elTips?: [string, number, number][], willAttachs?: number[],
        } = {}) {
        const { isAttach = false, isSummon = -1, pidx = this.playerIdx, isWind = false, isExec = true, isChargedAtk = false,
            skidx = -1, sktype = -1, isReadySkill = false, isWindExec = true, isFallAtk = false, willheals = [-1, -1, -1, -1, -1, -1],
            elrcmds = [[], []], usedDice = 0, dmgElements = [0, 0, 0], minusDiceSkill, willAttachs = [0, 0, 0],
            elTips = [['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0]], atriggers: atrg = [[], [], []],
            etriggers: etrg = [[], [], []] } = options;
        let res = {
            willDamage: clone(willDamage),
            willAttachs: [...willAttachs],
            dmgElements: [...dmgElements],
            eheros: clone(eheros),
            summon: clone(summon),
            aheros: clone(aheros),
            summonOppo: clone(summonOppo),
            elTips: clone(elTips),
            atriggers: clone(atrg),
            etriggers: clone(etrg),
            willheals: clone(willheals),
            elrcmds: clone(elrcmds),
            minusDiceSkill: clone(minusDiceSkill),
        };
        const epidx = pidx ^ 1;
        const oeheros = clone(eheros);
        const attachElements = eheros.map(h => [...h.attachElement]);
        let efhero = res.eheros[frontIdx];
        if (efhero.hp <= 0) return res;
        const aFrontIdx = getAtkHidx(aheros);
        let afhero = res.aheros[aFrontIdx];
        const isElReaction: number[] = new Array(8).fill(0);
        const isElStatus = [false, false]; // [绽放, 激化]
        if (res.willDamage[frontIdx][0] > 0 || isAttach) {
            res.dmgElements[frontIdx] = willAttach;
            if (!attachElements[frontIdx].includes(willAttach) && ![5, 6].includes(willAttach)) res.willAttachs[frontIdx] = willAttach;
            if ([0, 2].includes(willAttach) && efhero.inStatus.some(ist => ist.id == 2004)) { // 碎冰
                const freezeIdx = res.eheros[frontIdx].inStatus.findIndex(ist => ist.id == 2004);
                res.eheros[frontIdx].inStatus.splice(freezeIdx, 1);
                res.willDamage[frontIdx][0] += 2;
            }
            if (attachElements[frontIdx].length == 0 || attachElements[frontIdx].includes(willAttach)) { // 没有元素反应
                if (attachElements[frontIdx].length == 0 && ![0, 5, 6].includes(willAttach)) {
                    attachElements[frontIdx].push(willAttach);
                }
            } else if (willAttach > 0) {
                let attachElement = -1;
                isElReaction[0] = 1;
                if (attachElements[frontIdx].length > 1) { // 冰草共存时先与冰元素反应
                    const iceIdx = attachElements[frontIdx].findIndex(el => el == 4);
                    attachElement = attachElements[frontIdx].splice(iceIdx, iceIdx + 1)[0];
                } else if (willAttach > 0) {
                    attachElement = attachElements[frontIdx].splice(0, 1)[0];
                }
                const elTipIdx = (pidx ^ (isAttach ? 1 : 0)) * 3 + frontIdx;
                if (willAttach == 5 && attachElement < 5) { // 扩散
                    const otheridx = [1, 2].map(i => (frontIdx + i) % eheros.length);
                    otheridx.forEach((i, idx) => {
                        if (res.willDamage[i][0] < 0) res.willDamage[i][0] = 0;
                        ++res.willDamage[i][0];
                        res.eheros[frontIdx].attachElement = attachElements[frontIdx];
                        res = this._elementReaction(attachElement, res.willDamage, i,
                            res.eheros, res.summon, res.aheros, res.summonOppo,
                            {
                                ...options, isWind: true, isWindExec: idx == otheridx.length - 1,
                                atriggers: res.atriggers, etriggers: res.etriggers, dmgElements: res.dmgElements,
                                elTips: res.elTips, willAttachs: res.willAttachs,
                            });
                    });
                    res.willAttachs[frontIdx] = willAttach;
                    isElReaction[attachElement] = 1;
                    isElReaction[5] = attachElement;
                    res.elTips[elTipIdx] = ['扩散', willAttach, attachElement];
                    efhero = res.eheros[frontIdx];
                    afhero = res.aheros[aFrontIdx];
                } else if (willAttach == 6 && attachElement < 5) { // 结晶
                    res.willAttachs[frontIdx] = willAttach;
                    ++res.willDamage[frontIdx][0];
                    isElReaction[attachElement] = 1;
                    isElReaction[6] = attachElement;
                    res.elTips[elTipIdx] = ['结晶', willAttach, attachElement];
                } else {
                    const attachType = (1 << attachElement) + (1 << willAttach);
                    const hasEls = (el1: number, el2: number) => (attachType >> el1 & 1) == 1 && (attachType >> el2 & 1) == 1;
                    if (hasEls(4, 7)) { // 冰草共存
                        isElReaction[0] = 0;
                        attachElements[frontIdx].push(attachElement, willAttach);
                    } else if (hasEls(1, 2) || hasEls(2, 4)) { // 水火 蒸发  冰火 融化
                        res.willDamage[frontIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = [attachType == 6 ? '蒸发' : '融化', willAttach, attachElement];
                    } else if (hasEls(1, 3) || hasEls(3, 4)) { // 水雷 感电  冰雷 超导
                        if (!isAttach) {
                            res.willDamage.forEach((dmg, i) => {
                                const idx = i == frontIdx ? 0 : 1;
                                if (dmg[idx] < 0) dmg[idx] = 0;
                                ++dmg[idx];
                            });
                        }
                        res.elTips[elTipIdx] = [attachType == 10 ? '感电' : '超导', willAttach, attachElement];
                    } else if (hasEls(1, 4)) { // 水冰 冻结
                        res.willDamage[frontIdx][0] += isAttach ? 0 : 1;
                        efhero.inStatus = this._updateStatus([heroStatus(2004)], efhero.inStatus).nstatus;
                        res.elTips[elTipIdx] = ['冻结', willAttach, attachElement];
                    } else if (hasEls(1, 7)) { // 水草 绽放
                        ++res.willDamage[frontIdx][0];
                        isElStatus[0] = true;
                        res.elTips[elTipIdx] = ['绽放', willAttach, attachElement];
                    } else if (hasEls(2, 3)) { // 火雷 超载
                        res.willDamage[frontIdx][0] += 2;
                        if (efhero.isFront) res.elrcmds[0].push({ cmd: 'switch-after', cnt: 2500 });
                        res.elTips[elTipIdx] = ['超载', willAttach, attachElement];
                    } else if (hasEls(2, 7)) { // 火草 燃烧
                        ++res.willDamage[frontIdx][0];
                        res.summonOppo = this._updateSummon([newSummonee(3002)], res.summonOppo, afhero.outStatus, { isSummon });
                        res.elTips[elTipIdx] = ['燃烧', willAttach, attachElement];
                    } else if (hasEls(3, 7)) { // 雷草 原激化
                        ++res.willDamage[frontIdx][0];
                        isElStatus[1] = true;
                        res.elTips[elTipIdx] = ['原激化', willAttach, attachElement];
                    }
                    [1, 2, 3, 4, 7].filter(el => attachType >> el & 1).forEach(el => isElReaction[el] = 1);
                }
            }
            res.eheros[frontIdx].attachElement = attachElements[frontIdx];
        }
        const slotInStatus: Status[][] = [[], [], []];
        const slotOutStatus: Status[] = [];
        const eslotInStatus: Status[][] = [[], [], []];
        const eslotOutStatus: Status[] = [];
        const atriggers: Trigger[][] = [[], [], []];
        const etriggers: Trigger[][] = [[], [], []];
        etriggers.forEach((trg, tidx) => {
            if (res.willDamage[tidx][0] > 0 || res.willDamage[tidx][1] > 0) {
                trg.push('getdmg');
                if (willAttach > 0) trg.push('el-getdmg');
                if (res.willDamage[tidx][0] > 0) trg.push(`${ELEMENT_ICON[willAttach]}-getdmg` as Trigger);
                if (res.willDamage[tidx][1] > 0) trg.push('pen-getdmg');
            }
        });
        isElReaction.forEach((el, i) => {
            if (el > 0) {
                if (i == 0) {
                    atriggers.forEach((trgs, tri) => {
                        if (tri == aFrontIdx) trgs.push('elReaction', 'get-elReaction-oppo');
                        else trgs.push('other-elReaction');
                    });
                    etriggers[frontIdx].push('get-elReaction');
                } else {
                    atriggers.forEach((trgs, tri) => {
                        if (tri == aFrontIdx) trgs.push(`el${i}Reaction${[5, 6].includes(i) ? `:${el}` : ''}` as Trigger);
                        else trgs.push(`other-el${i}Reaction` as Trigger);
                    });
                    etriggers[frontIdx].push(`get-el${i}Reaction${[5, 6].includes(i) ? `:${el}` : ''}` as Trigger);
                }
            }
        });
        if (!isAttach) {
            if (isWind) {
                etriggers[frontIdx].push(`${ELEMENT_ICON[willAttach]}-getdmg-wind` as Trigger);
                if (!atriggers[aFrontIdx].includes(`${ELEMENT_ICON[willAttach]}-dmg-wind` as Trigger)) {
                    atriggers[aFrontIdx].push(`${ELEMENT_ICON[willAttach]}-dmg-wind` as Trigger);
                }
            } else {
                if (res.willDamage.some(dmg => dmg[0] > 0) || res.willDamage.some(dmg => dmg[1] > 0)) {
                    atriggers[aFrontIdx].push('dmg', 'getdmg-oppo');
                    if (willAttach > 0) atriggers[aFrontIdx].push('el-dmg', 'el-getdmg-oppo');
                    if (res.willDamage.some(dmg => dmg[0] > 0)) {
                        atriggers[aFrontIdx].push(`${ELEMENT_ICON[willAttach]}-dmg` as Trigger, `${ELEMENT_ICON[willAttach]}-getdmg-oppo` as Trigger);
                    }
                    if (res.willDamage.some(dmg => dmg[1] > 0)) {
                        atriggers[aFrontIdx].push('pen-dmg', 'pen-getdmg-oppo');
                    }
                }
                if (skidx > -1 && !isReadySkill) {
                    atriggers.forEach((trg, ti) => {
                        const isOther = ti != aFrontIdx ? 'other-' : '';
                        trg.push(`${isOther}skill`, `${isOther}skilltype${sktype}` as Trigger);
                    });
                    etriggers[frontIdx].push('oppo-skill');
                }
                if (isReadySkill) atriggers[aFrontIdx].push('useReadySkill');
            }
            const slotSummons: Summonee[] = [];
            for (let i = 0; i < res.aheros.length; ++i) {
                const slotres = this._doSlot(atriggers[isSummon > -1 ? aFrontIdx : i], {
                    hidxs: i,
                    pidx,
                    heros: res.aheros,
                    eheros: oeheros,
                    ehidx: frontIdx,
                    summons: res.summonOppo,
                    isChargedAtk,
                    isFallAtk,
                    isSkill: skidx,
                    usedDice,
                    isExec,
                    minusDiceSkill: res.minusDiceSkill,
                    card: this.currCard,
                });
                slotInStatus[i].push(...(slotres.inStatus ?? []));
                slotOutStatus.push(...(slotres.outStatus ?? []));
                slotSummons.push(...(slotres.summon ?? []));
                slotres.willHeals.forEach((hl, hli) => {
                    if (hl >= 0) {
                        const nhli = hli + epidx * 3;
                        if (res.willheals[nhli] < 0) res.willheals[nhli] = hl;
                        else res.willheals[nhli] += hl;
                    }
                });
                if (res.willDamage[frontIdx][0] > 0) res.willDamage[frontIdx][0] += slotres.addDmg + (isSummon > -1 ? slotres.addDmgSummon : 0);
                if (skidx > -1) res.minusDiceSkill = slotres.minusDiceSkill;
            }
            res.summonOppo = this._updateSummon(slotSummons, res.summonOppo, afhero.outStatus, { isSummon });
            for (let i = 0; i < res.eheros.length; ++i) {
                const slotres = this._doSlot(etriggers[i], {
                    hidxs: i,
                    pidx: epidx,
                    heros: res.eheros,
                    eheros: res.aheros,
                    isExec,
                    intvl: [2300, 500, 1200, 300],
                });
                eslotInStatus[i].push(...(slotres.inStatus ?? []));
                eslotOutStatus.push(...(slotres.outStatus ?? []));
                res.eheros.forEach((h, hi) => {
                    const hli = hi + pidx * 3;
                    if (slotres.willHeals[hi] > 0 && h.hp > res.willDamage[hi].reduce((a, b) => a + Math.max(0, b))) {
                        if (res.willheals[hli] == -1) res.willheals[hli] = slotres.willHeals[hi];
                        else res.willheals[hli] = Math.min(h.maxhp - h.hp, (res.willheals[hli] ?? 0) + slotres.willHeals[hi]);
                    }
                });
            }
        }
        const aist: Status[] = [];
        const aost: Status[] = [];
        const doStatus = (status: Status[], isOppo: boolean, trgs: Trigger[], hi: number) => {
            const dmg = isOppo ? 'getDmg' : 'addDmgCdt';
            status.forEach(sts => {
                for (const trigger of trgs) {
                    const stsres = heroStatus(sts.id).handle(sts, {
                        heros: isOppo ? res.eheros : res.aheros,
                        hidx: hi,
                        eheros: isOppo ? res.aheros : res.eheros,
                        isChargedAtk,
                        trigger,
                        skilltype: sktype,
                        isElStatus,
                        isFallAtk,
                        hasDmg: res.willDamage[frontIdx][0] > 0,
                        isSkill: skidx,
                        dmgSource: skidx > -1 ? afhero.id : isSummon,
                        card: this.currCard,
                        minusDiceSkill: res.minusDiceSkill,
                    });
                    if (this._hasNotTrigger(stsres.trigger, trigger)) continue;
                    if (res.willDamage[frontIdx][0] > 0) {
                        res.willDamage[frontIdx][0] += (stsres?.[`${dmg}`] ?? 0) + (isSummon > -1 ? stsres?.addDmgSummon ?? 0 : 0);
                    }
                    if (stsres?.summon && !isOppo) {
                        res.summonOppo = this._updateSummon(stsres.summon, res.summonOppo, afhero.outStatus);
                    }
                    if (stsres?.cmds) res.elrcmds[isOppo ? 1 : 0].push(...stsres.cmds);
                    if (skidx > -1 && !isOppo) res.minusDiceSkill = stsres.minusDiceSkill;
                    if (!sts.type.includes(1)) {
                        if (stsres?.heal) {
                            const stshl = stsres.heal ?? 0;
                            (stsres?.hidxs ?? [aFrontIdx]).forEach(hlhidx => {
                                const hli = hlhidx + (isOppo ? pidx : epidx) * 3;
                                if (res.willheals[hli] < 0) res.willheals[hli] = stshl;
                                else res.willheals[hli] += stshl;
                            });
                        }
                        if (stsres?.pendamage) {
                            (stsres.hidxs ?? allHidxs(res.eheros, { exclude: frontIdx })).forEach(hi => {
                                res.willDamage[hi][1] += stsres?.pendamage ?? 0;
                            });
                        }
                    } else if (trigger.startsWith('skill')) {
                        (isOppo ? res.etriggers : res.atriggers)[hi].push('after-' + trigger as Trigger);
                    }
                    if (stsres?.exec && isWindExec && !sts.type.includes(11)) {
                        const { inStatus = [], outStatus = [], cmds = [] } = stsres.exec();
                        aist.push(...inStatus);
                        aost.push(...outStatus);
                        res.elrcmds[isOppo ? 1 : 0].push(...cmds);
                    }
                }
            });
        }
        atriggers.forEach((t, ti) => {
            res.atriggers[ti] = [...new Set([...res.atriggers[ti], ...t])];
        });
        etriggers.forEach((t, ti) => {
            if (ti == frontIdx) t.push('status-destroy');
            res.etriggers[ti] = [...new Set([...res.etriggers[ti], ...t])];
        });
        res.aheros.forEach((h, hi) => {
            doStatus(h.inStatus, false, res.atriggers[hi], hi);
            if (h.isFront) doStatus(h.outStatus, false, res.atriggers[aFrontIdx], aFrontIdx);
        });
        res.eheros.forEach((h, hi) => {
            doStatus(h.inStatus, true, res.etriggers[hi], hi);
            if (h.isFront) doStatus(h.outStatus, true, res.etriggers[hi], hi);
        });
        const smncmds: Cmds[] = []
        for (const trigger of [...new Set(etriggers.flat())]) {
            const { smncmds: smncmd } = this._doSummon(epidx, trigger, { csummon: res.summon, isExec });
            smncmds.push(...smncmd);
        }
        const { heros: smneheros } = this._doCmds(smncmds, { pidx: epidx, heros: res.eheros });
        if (smneheros) {
            res.eheros = [...smneheros];
            efhero = res.eheros[frontIdx];
        }
        for (const trigger of atriggers[aFrontIdx]) {
            const { addDmg, willheals = [], minusDiceSkill } = this._doSummon(pidx, trigger, {
                intvl: [100, 700, 2000, 200],
                csummon: res.summonOppo,
                isDmg: true,
                isChargedAtk,
                isFallAtk,
                isExec,
                hcard: this.currCard,
                minusDiceSkill: res.minusDiceSkill,
                isUseSkill: skidx > -1,
            });
            if (res.willDamage[frontIdx][0] > 0) res.willDamage[frontIdx][0] += addDmg;
            if (willheals.length > 0) {
                willheals.forEach((hl, hli) => {
                    if (hl >= 0) {
                        if (res.willheals[hli] < 0) res.willheals[hli] = hl;
                        else res.willheals[hli] += hl;
                    }
                });
            }
            res.minusDiceSkill = minusDiceSkill;
            if (trigger.startsWith('el5Reaction')) { // 召唤物形成扩散反应
                this._doSummon(pidx, trigger, { intvl: [100, 500, 500, 100], csummon: res.summonOppo, isUnshift: true, isExec });
            }
        }
        res.summon = this._updateSummon([], res.summon, efhero.outStatus);
        res.summonOppo = this._updateSummon([], res.summonOppo, afhero.outStatus);
        if (res.atriggers[aFrontIdx].includes('el-getdmg-oppo')) {
            let elcnt = this.players[this.playerIdx].playerInfo.oppoGetElDmgType;
            for (const trg of res.atriggers[aFrontIdx]) {
                const el = ELEMENT_ICON.indexOf(trg.slice(0, trg.indexOf('-getdmg-oppo')));
                if (el == -1 || (elcnt >> el & 1) == 1) continue;
                elcnt |= (1 << el);
            }
            if (isExec) this.players[this.playerIdx].playerInfo.oppoGetElDmgType = elcnt;
        }

        let restDmg = res.willDamage[frontIdx][0];
        if (efhero.talentSlot?.subType.includes(-1) && efhero.isFront) {
            const { restDmg: slotresdmg = 0, inStatusOppo = [], hidxs }
                = cardsTotal(efhero.talentSlot.id).handle(efhero.talentSlot, { restDmg, heros: res.eheros, hidxs: [frontIdx] });
            restDmg = slotresdmg;
            for (const slidx of (hidxs ?? [aFrontIdx])) {
                slotInStatus[slidx].push(...inStatusOppo);
            }
        }
        efhero.inStatus.filter(ist => ist.type.some(t => [2, 7].includes(t))).forEach(ist => {
            restDmg = heroStatus(ist.id).handle(ist, { restDmg, willAttach, heros: res.eheros, hidx: frontIdx, isSummon }).restDmg ?? 0;
        });
        if (efhero.isFront) {
            efhero.outStatus.filter(ost => ost.type.some(t => [2, 7].includes(t))).forEach(ost => {
                const oSummon = res.summon.find(smn => smn.id == ost.summonId);
                const { restDmg: nrdmg = 0, pendamage = 0, hidxs: penhidxs = [] } = heroStatus(ost.id).handle(ost, {
                    restDmg,
                    summon: oSummon,
                    willAttach,
                    heros: res.eheros,
                    hidx: frontIdx,
                });
                restDmg = nrdmg;
                if (pendamage > 0 && penhidxs.length > 0) {
                    penhidxs.forEach(v => res.willDamage[v][1] += pendamage);
                }
            });
            afhero.outStatus.filter(ost => ost.type.includes(5)).forEach(ost => {
                restDmg = heroStatus(ost.id).handle(ost, { restDmg }).restDmg ?? 0;
            });
        }
        res.willDamage[frontIdx][0] = restDmg;
        res.aheros.forEach((h, hi) => res.willheals[hi + epidx * 3] = Math.min(h.maxhp - h.hp, res.willheals[hi + epidx * 3]));
        res.eheros.forEach((h, hi) => res.willheals[hi + pidx * 3] = Math.min(h.maxhp - h.hp, res.willheals[hi + pidx * 3]));
        res.eheros = this._doSkill5(frontIdx, etriggers[frontIdx], { pidx: pidx ^ 1, heros: res.eheros, isExec, dmg: restDmg }).heros;

        for (let i = 0; i < res.aheros.length; ++i) {
            const { nstatus, nheros } = this._updateStatus([...(i == aFrontIdx ? aist : []), ...slotInStatus[i]], res.aheros[i].inStatus, res.aheros, i);
            if (nheros) {
                nheros[i].inStatus = [...nstatus];
                res.aheros = nheros;
            }
        }
        const { nstatus: naost, nheros: nah } = this._updateStatus([...slotOutStatus, ...(isElReaction[6] > 0 ? [heroStatus(2007)] : []), ...aost], afhero.outStatus, res.aheros, aFrontIdx);
        if (nah) {
            nah[aFrontIdx].outStatus = [...naost];
            if (isElStatus[0] && naost.every(ost => ost.id != 2111)) {
                nah[aFrontIdx].outStatus = this._updateStatus([heroStatus(2005)], nah[aFrontIdx].outStatus).nstatus;
            }
            if (isElStatus[1]) nah[aFrontIdx].outStatus = this._updateStatus([heroStatus(2006)], nah[aFrontIdx].outStatus).nstatus;
            res.aheros = nah;
        }
        for (let i = 0; i < res.aheros.length; ++i) {
            const { nstatus, nheros } = this._updateStatus(eslotInStatus[i], res.eheros[i].inStatus, res.eheros, i);
            if (nheros) {
                nheros[i].inStatus = [...nstatus];
                res.eheros = nheros;
            }
        }
        const { nstatus: neost, nheros: neh } = this._updateStatus(eslotOutStatus, efhero.outStatus, res.eheros, frontIdx);
        if (neh) {
            neh[frontIdx].outStatus = [...neost];
            res.eheros = neh;
        }
        if (isWindExec && isExec) {
            if (res.willDamage.some(d => Math.max(0, d[0]) + Math.max(0, d[1]) > 0)) {
                const willkilledhidxs: number[] = [];
                res.eheros.forEach((h, hi) => {
                    if (h.hp <= res.willDamage[hi].reduce((a, b) => a + b)) {
                        willkilledhidxs.push(hi);
                    }
                });
                if (willkilledhidxs.length > 0) {
                    const dieHeros: [Hero, number][] = clone(res.eheros.filter((_, hi) => willkilledhidxs.includes(hi)).map(h1 => [h1, res.eheros.findIndex(h2 => h2.id == h1.id)]));
                    this._doStatus(pidx ^ 1, 13, 'will-killed', { intvl: [2300, 100, 100, 2300], hidxs: willkilledhidxs, heros: res.eheros, eheros: res.aheros, isUnshift: true });
                    const slotDestroyHidxs = dieHeros.filter(([h]) => {
                        const isDie = h.inStatus.every(ist => !ist.type.includes(13)) && (h.weaponSlot != null || h.artifactSlot != null || h.talentSlot != null);
                        const revHero = res.eheros.find(eh => eh.id == h.id);
                        const isRevive = revHero?.weaponSlot != h.weaponSlot || revHero?.artifactSlot != h.artifactSlot || revHero?.talentSlot != h.talentSlot;
                        return isDie || isRevive;
                    }).map(v => v[1]);
                    if (slotDestroyHidxs.length > 0) {
                        const { cmds = [] } = this._doStatus(pidx ^ 1, 4, 'slot-destroy', { hidxs: slotDestroyHidxs, heros: res.eheros });
                        res.elrcmds[1].push(...cmds);
                    }
                }
            }
        }
        return res;
    }
    /**
     * 获取骰子
     * @param cnt 获取骰子数量
     * @param element 获取骰子元素 -3为当前出战角色下一个角色元素 -2为当前出战角色元素 -1为随机不重复骰子 数字为所有一样 数组为指定元素
     * @param pidx 获取骰子的玩家idx
     * @returns 传给服务器的dice格式
     */
    _getDice(dices: DiceVO[] | null, cnt: number, element: number | number[], options: { pidx?: number } = {}) {
        const { pidx = this.playerIdx } = options;
        const ndices = dices ?? this.players[pidx].dice.filter((_, i) => !this.players[pidx].diceSelect[i]).map(v => ({ val: v, isSelected: false }));
        const newDice: number[] = [];
        for (let i = 0; i < cnt; ++i) {
            if (element == -1) {
                let ndice = Math.ceil(Math.random() * 7);
                while (newDice.includes(ndice)) ndice = Math.ceil(Math.random() * 7);
                newDice.push(ndice);
            } else if (element == -2) {
                newDice.push(this._getFrontHero(pidx != this.playerIdx).element);
            } else if (element == -3) {
                const heros = this.players[pidx].heros.map((h, hi) => ({ hi, el: h.element, hp: h.hp, fr: h.isFront })).filter(v => v.hp > 0);
                const fhidx = heros.findIndex(h => h.fr);
                const element = heros[(fhidx + 1) % heros.length].el;
                newDice.push(element);
            } else {
                if (typeof element == 'number') newDice.push(element);
                else newDice.push(element[i]);
            }
        }
        newDice.forEach(val => ndices.push({ val, isSelected: false }));
        ndices.splice(16, 10);
        return this.rollDice(ndices, { pidx, frontIdx: this.players[pidx].hidx });
    }
    /**
     * 召唤物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param time 当前时间
     * @param options intvl 间隔时间, isUnshift 是否前插入事件, csummon 当前的召唤物, isExec 是否执行召唤物攻击, isDmg 是否造成伤害, isExecTask 是否执行任务队列, hidx 当前出战角色
     *                isChargedAtk 是否为重击, isFallAtk 是否为下落攻击, hcard 使用的牌, minusDiceSkill 用技能减骰子, isUseSkill 是否使用技能, tsummon 执行task的召唤物
     * @returns smncmds 命令集, addDmg 加伤, addDiceHero 增加切换角色骰子数, changeHeroDiceCnt 改变骰子数, minusDiceSkill 用技能减骰子, willheals 将回血数
     */
    _doSummon(pidx: number, ostate: Trigger | Trigger[],
        options: {
            intvl?: number[], isUnshift?: boolean, csummon?: Summonee[], isExec?: boolean, isDmg?: boolean, isExecTask?: boolean, hidx?: number,
            isChargedAtk?: boolean, isFallAtk?: boolean, hcard?: Card, minusDiceSkill?: number[][], isUseSkill?: boolean, tsummon?: Summonee[],
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostate == 'string') states.push(ostate);
        else states.push(...ostate);
        const { intvl, isUnshift = false, csummon, isExec = true, isDmg = false, isChargedAtk = false, hidx = this.players[pidx].hidx,
            isFallAtk = false, hcard, isExecTask = false, isUseSkill = false, tsummon } = options;
        let { minusDiceSkill } = options;
        const p = this.players[pidx];
        const smncmds: Cmds[] = [];
        let addDmg = 0;
        let addDiceHero = 0;
        let changeHeroDiceCnt = 0;
        let willheals: number[] | undefined;
        let task: [(() => void)[], number[]] | undefined;
        const summons: Summonee[] = tsummon ?? csummon ?? [...p.summon];
        for (const state of states) {
            for (const summon of summons) {
                const summonres = newSummonee(summon.id).handle(summon, {
                    trigger: state,
                    heros: p.heros,
                    eheros: this.players[p.pidx ^ 1].heros,
                    hidxs: [hidx],
                    isChargedAtk,
                    isFallAtk,
                    hcard,
                    isExec,
                    minusDiceSkill,
                });
                if (this._hasNotTrigger(summonres?.trigger, state)) continue;
                if (summonres?.isNotAddTask) {
                    addDmg += summonres?.addDmgCdt ?? 0;
                    addDiceHero += summonres?.addDiceHero ?? 0;
                    minusDiceSkill = summonres?.minusDiceSkill ?? minusDiceSkill;
                    if (!isExec) continue;
                    if (summonres?.exec && (!isDmg || summonres.damage == undefined)) {
                        const { cmds = [], changeHeroDiceCnt: smnDiceCnt = 0 } = summonres?.exec?.({ summon });
                        const { changedEl } = this._doCmds(cmds, { pidx: p.pidx, isExec });
                        if (changedEl) summon.element = changedEl;
                        smncmds.push(...cmds);
                        changeHeroDiceCnt = smnDiceCnt;
                    }
                    continue;
                }
                if (summonres?.cmds) {
                    const { willHeals, heros } = this._doCmds(summonres.cmds, { pidx: p.pidx, isExec });
                    willheals = willHeals;
                    if (heros) p.heros = heros;
                }
                if (state.startsWith('skill') && intvl) intvl[0] = 2100;
                if (isExec && intvl) {
                    if (!isExecTask) {
                        const args = Array.from(arguments);
                        args[2] = clone(args[2]) ?? {};
                        args[2].isExecTask = true;
                        args[2].tsummon = [summon];
                        this.taskQueue.addTask('summon', args, isUnshift);
                    } else {
                        let aSummon = csummon ?? [...p.summon];
                        const summonHandle = [
                            () => { // 边框亮起
                                this.socket.emit('sendToServer', {
                                    cpidx: p.pidx,
                                    currSummon: summon,
                                    flag: `_doSummon1-${summon.name}-${p.pidx}`,
                                });
                            },
                            () => { // 扣血、显示伤害、效果变化
                                console.info(`[${p.name}]${state}:${summon.name}.useCnt:${summon.useCnt}->${summon.useCnt - 1}`);
                                const smnexecres = summonres?.exec?.({ summon: summon });
                                if (smnexecres?.cmds) {
                                    let { heros: eHeros, hidx: eFrontIdx, summon: eSummon } = this.players[p.pidx ^ 1];
                                    let { heros: aHeros, hidx: frontIdx } = this.players[p.pidx];
                                    let aheros: Hero[] = clone(aHeros);
                                    let eheros: Hero[] = clone(eHeros);
                                    let esummon: Summonee[] = [...eSummon];
                                    let smncmds: Cmds[] = [];
                                    let currSummon: Summonee | undefined;
                                    let willDamages: number[][] | undefined;
                                    let dmgElements: number[] = [0, 0, 0];
                                    let aWillAttachs: number[][] = [[], [], [], [], [], []];
                                    let aElTips: [string, number, number][] = [['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0]];
                                    const { changedEl, inStatus, outStatus, heros, willHeals } = this._doCmds(smnexecres.cmds, { pidx: p.pidx, heal: summon.shield });
                                    if (changedEl) summon.element = changedEl;
                                    const smnIdx = aSummon.findIndex(smn => smn.id == summon.id);
                                    aSummon[smnIdx] = summon;
                                    if (heros) aheros = [...heros];
                                    if (inStatus) aheros[frontIdx].inStatus = [...inStatus];
                                    if (outStatus) aheros[frontIdx].outStatus = [...outStatus];
                                    const heal = willHeals?.slice(3 - p.pidx * 3, 6 - p.pidx * 3).map(v => Math.max(0, v) % 100);
                                    if (heal?.some(hl => hl > 0)) {
                                        this._doSlot('heal', { pidx: p.pidx, hidxs: allHidxs(p.heros, { isAll: true }), heal });
                                        this._doStatus(p.pidx, 4, 'heal', { heal });
                                    }
                                    let statusIdsAndPidx: StatusTask[] = [];
                                    let isSwitchAtk = false;
                                    for (let i = 0; i < smnexecres.cmds.length; ++i) {
                                        const { cmd, hidxs, cnt, isAttach = false } = smnexecres.cmds[i];
                                        if (cmd == 'attack') {
                                            if (summon.pendamage == 0 && hidxs != undefined) eFrontIdx = hidxs[0];
                                            let { willDamage, willAttachs, dmgElements: dmgElements1, eheros: eheros1, summon: esummon1,
                                                aheros: aheros1, summonOppo: asummon1, elrcmds: elrcmds1, elTips: elTips1 }
                                                = this._elementReaction(
                                                    summon.element,
                                                    [0, 0, 0].map((_, i) => [
                                                        i == eFrontIdx ? ((cnt ?? summon.damage) || -1) : -1,
                                                        hidxs?.includes(i) || (i != eFrontIdx && hidxs == undefined) ? summon.pendamage : 0
                                                    ]),
                                                    eFrontIdx,
                                                    eheros, esummon,
                                                    aheros, aSummon,
                                                    { pidx: p.pidx, isSummon: summon.id }
                                                );
                                            if (p.pidx == 0) this.willDamages = [...clone(willDamage), [-1, 0], [-1, 0], [-1, 0]];
                                            else this.willDamages = [[-1, 0], [-1, 0], [-1, 0], ...clone(willDamage)];
                                            willDamages = this.willDamages;
                                            dmgElements = dmgElements1;
                                            aheros = [...aheros1];
                                            eheros = [...eheros1];
                                            esummon = [...esummon1];
                                            aSummon = [...asummon1];
                                            aElTips = [...elTips1];
                                            for (let i = 0; i < 3; ++i) aWillAttachs[i + (p.pidx ^ 1) * 3].push(willAttachs[i]);
                                            smncmds.push(...elrcmds1[0]);
                                            const triggers: Trigger[] = ['status-destroy'];
                                            for (const trigger of triggers) {
                                                [...eheros[eFrontIdx].inStatus, ...eheros[eFrontIdx].outStatus].forEach(sts => {
                                                    if (sts.type.includes(1)) {
                                                        const stsres = heroStatus(sts.id).handle(sts, {
                                                            heros: eheros,
                                                            eheros: aheros,
                                                            hidx: eFrontIdx,
                                                            trigger,
                                                        });
                                                        if (stsres.trigger?.includes(trigger) && (stsres.damage || stsres.pendamage || stsres.heal)) {
                                                            const isOppo = stsres.isOppo ? 1 : 0;
                                                            statusIdsAndPidx.push({ id: sts.id, type: sts.group, pidx: p.pidx ^ isOppo ^ 1, isOppo, trigger });
                                                        }
                                                    }
                                                });
                                            }
                                            this.taskQueue.addStatusId(statusIdsAndPidx, true);
                                            if (elrcmds1[0].some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'))) {
                                                const { statusIdsAndPidx: stpidx } = this._doStatus(p.pidx ^ 1, 1, 'change-from', { hidxs: [eFrontIdx] });
                                                if (stpidx.length > 0) isSwitchAtk = true;
                                            }
                                        }
                                        if (isAttach) {
                                            const { eheros: eheros2, willAttachs, aheros: aheros2, summon: asummon2, summonOppo: esummon2, elrcmds: elrcmds2, elTips: elTips2 }
                                                = this._elementReaction(
                                                    summon.element,
                                                    [[-1, 0], [-1, 0], [-1, 0]],
                                                    this.players[p.pidx].hidx,
                                                    aheros, aSummon,
                                                    eheros, esummon,
                                                    { isAttach }
                                                );
                                            eheros = [...aheros2];
                                            aheros = [...eheros2];
                                            aSummon = [...asummon2];
                                            esummon = [...esummon2];
                                            smncmds.push(...elrcmds2[0]);
                                            aElTips = [...elTips2];
                                            for (let i = 0; i < 3; ++i) aWillAttachs[i + p.pidx * 3].push(willAttachs[i]);
                                        }
                                        currSummon = summon;
                                    }
                                    const willAttachs: number[][] = [[], [], [], [], [], []];
                                    willAttachs[eFrontIdx + (p.pidx ^ 1) * 3].push(summon.element);
                                    this.socket.emit('sendToServer', {
                                        cpidx: p.pidx,
                                        currSummon,
                                        heros: aheros,
                                        eheros: eheros,
                                        esummon,
                                        willAttachs,
                                        willDamage: willDamages,
                                        dmgElements,
                                        elTips: aElTips,
                                        smncmds: [...smnexecres.cmds, ...smncmds],
                                        playerInfo: this.players[p.pidx].playerInfo,
                                        isEndAtk: this.taskQueue.isTaskEmpty() && !isSwitchAtk,
                                        isUseSkill,
                                        flag: `_doSummon2-${summon.name}-${p.pidx}`,
                                    });
                                }
                            },
                            () => { // 边框变暗
                                this.socket.emit('sendToServer', {
                                    cpidx: p.pidx,
                                    currSummon: summon,
                                    summonee: aSummon,
                                    flag: `_doSummon3-${summon.name}-${p.pidx}`,
                                });
                            },
                            (isEndAtk = false) => { // 更新summon数据
                                const outStatus = this.players[p.pidx].heros[p.hidx].outStatus;
                                const summonee = this._updateSummon([], aSummon, outStatus, { trigger: state });
                                this.socket.emit('sendToServer', {
                                    cpidx: p.pidx,
                                    currSummon: summon,
                                    summonee,
                                    outStatus,
                                    isEndAtk,
                                    flag: `_doSummon4-${summon.name}-${p.pidx}`,
                                });
                            }
                        ];
                        task = [summonHandle, intvl];
                    }
                }
            }
        }
        return { smncmds, addDmg, addDiceHero, changeHeroDiceCnt, willheals, minusDiceSkill, task }
    }
    /**
     * 场地效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param time 当前时间
     * @param options intvl 间隔时间, changeHeroDiceCnt 切换需要的骰子, hcard 使用的牌, players 最新的玩家信息, summonDiffCnt 减少的召唤物数量, 
     *                hidx 将要切换的玩家, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列, isExec 是否执行, firstPlayer 先手玩家pidx,
     * @returns isQuickAction 是否快速行动, cmds 命令集, exchangeSite 交换的支援牌, outStatus 出战状态, minusDiceHero 减少切换角色骰子, siteCnt 支援区数量,
     *          minusDiceCard 减少使用卡骰子, minusDiceSkill 用技能减骰子
     */
    _doSite(pidx: number, ostates: Trigger | Trigger[],
        options: {
            intvl?: number[], changeHeroDiceCnt?: number, hcard?: Card, players?: Player[], summonDiffCnt?: number, firstPlayer?: number,
            isExec?: boolean, isQuickAction?: boolean, minusDiceCard?: number, csite?: Site[], hidx?: number, isSkill?: number,
            minusDiceSkill?: number[][], isExecTask?: boolean,
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostates == 'string') states.push(ostates);
        else states.push(...ostates);
        const { intvl, hcard, players = this.players, isExec = true, firstPlayer = -1, hidx = -1, isSkill = -1, isExecTask = false, csite } = options;
        let { changeHeroDiceCnt = 0, summonDiffCnt = 0, isQuickAction = false, minusDiceCard = 0, minusDiceSkill } = options;
        let exchangeSite: [Site, number][] = [];
        const cmds: Cmds[] = [];
        const outStatus: Status[] = [];
        let minusDiceHero = 0;
        const siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        let task: [(() => void)[], number[]] | undefined;
        if (isQuickAction || players.some(p => p.hidx < 0)) return { isQuickAction, cmds, exchangeSite, outStatus, minusDiceHero, siteCnt, task }
        const p = players[pidx];
        const imdices = [...players[p.pidx].dice];
        const destroys: number[] = [];
        const exeSite = csite ?? p.site;
        const lastSite: Site[] = [];
        let isLast = false;
        const doSite = (site: Site, stidx: number) => {
            for (const state of states) {
                const siteres = newSite(site.id).handle(site, {
                    dices: imdices,
                    trigger: state,
                    heros: p.heros,
                    eheros: players[p.pidx ^ 1].heros,
                    hidxs: [p.hidx],
                    hidx,
                    card: hcard,
                    hcards: players[p.pidx].handCards.concat(players[p.pidx].willGetCard),
                    isFirst: firstPlayer == p.pidx,
                    playerInfo: p.playerInfo,
                    minusDiceCard,
                    isSkill,
                    minusDiceSkill,
                });
                if (siteres?.isLast && !isLast) lastSite.push(site);
                if (this._hasNotTrigger(siteres.trigger, state) || (siteres?.isLast && !isLast)) continue;
                isQuickAction = siteres?.isQuickAction ?? false;
                minusDiceHero += siteres?.minusDiceHero ?? 0;
                minusDiceCard += siteres?.minusDiceCard ?? 0;
                minusDiceSkill = siteres?.minusDiceSkill ?? minusDiceSkill;
                const isExchange = siteres?.isExchange && (players[p.pidx ^ 1].site.length + exchangeSite.filter(v => v[1] == (p.pidx ^ 1)).length) < 4;
                if (isExchange) exchangeSite.push([site, p.pidx ^ 1]);
                siteCnt[p.pidx][stidx] = siteres?.siteCnt ?? 0;
                if (isExec) {
                    if (siteres?.isNotAddTask || intvl == undefined) {
                        const siteexecres = siteres?.exec?.({ isQuickAction, changeHeroDiceCnt, summonDiffCnt, minusDiceCard });
                        changeHeroDiceCnt = siteexecres?.changeHeroDiceCnt ?? 0;
                        cmds.push(...(siteexecres?.cmds ?? []));
                        outStatus.push(...(siteexecres?.outStatus ?? []));
                        if (siteexecres?.isDestroy && (!siteres?.isExchange || isExchange)) destroys.push(stidx);
                    } else {
                        if (!isExecTask) {
                            const args = Array.from(arguments);
                            args[2] = clone(args[2]) ?? {};
                            args[2].isExecTask = true;
                            args[2].csite = [site];
                            this.taskQueue.addTask('site', args);
                        } else {
                            const curIntvl = [...intvl];
                            let siteexecres: any;
                            const siteHandle = [
                                () => { // 边框亮起
                                    this.socket.emit('sendToServer', {
                                        cpidx: p.pidx,
                                        currSite: site,
                                        flag: `_doSite1-${site.card.name}${site.sid}-${p.pidx}`,
                                    });
                                },
                                () => { // 数量、效果变化
                                    siteexecres = siteres?.exec?.({ isQuickAction, changeHeroDiceCnt, summonDiffCnt, minusDiceCard });
                                    console.info(`[${p.name}]${state}:${site.card.name}-${site.sid}.cnt:${site.cnt}.perCnt:${site.perCnt}`);
                                    if (siteexecres?.cmds) {
                                        if (siteexecres.cmds.some((v: Cmds) => v.cmd == 'getCard')) curIntvl[2] = 2000;
                                        if (siteexecres.cmds.some((v: Cmds) => v.cmd == 'heal')) curIntvl[2] = 1000;
                                    }
                                    const { ndices, heros, willHeals } = this._doCmds(siteexecres?.cmds, { pidx: p.pidx });
                                    const heal = willHeals?.slice(3 - p.pidx * 3, 6 - p.pidx * 3).map(v => Math.max(0, v) % 100);
                                    if (heal?.some(hl => hl > 0)) {
                                        this._doSlot('heal', { pidx: p.pidx, hidxs: allHidxs(p.heros, { isAll: true }), heal });
                                        this._doStatus(p.pidx, 4, 'heal', { heal });
                                    }
                                    this.socket.emit('sendToServer', {
                                        cpidx: p.pidx,
                                        heros,
                                        currSite: site,
                                        dices: ndices,
                                        siteres: siteexecres,
                                        flag: `_doSite2-${site.card.name}${site.sid}-${p.pidx}`,
                                    });
                                },
                                () => { // 边框变暗
                                    this.socket.emit('sendToServer', {
                                        cpidx: p.pidx,
                                        currSite: site,
                                        site: players[p.pidx].site,
                                        flag: `_doSite3-${site.card.name}${site.sid}-${p.pidx}`,
                                    });
                                },
                                (isEndAtk = false) => { // 更新site数据
                                    siteexecres.isDestroy &&= (!siteres?.isExchange || isExchange);
                                    this.socket.emit('sendToServer', {
                                        cpidx: p.pidx,
                                        currSite: site,
                                        site: players[p.pidx].site,
                                        siteres: siteexecres,
                                        isEndAtk,
                                        flag: `_doSite4-${site.card.name}${site.sid}-${p.pidx}`,
                                    });
                                }
                            ];
                            task = [siteHandle, curIntvl];
                        }
                    }
                }
                if (siteres?.isOrTrigger) break;
            }
        }
        exeSite.forEach(doSite);
        isLast = true;
        lastSite.forEach(doSite);
        if (isExec) p.site = p.site.filter((_, stidx) => !destroys.includes(stidx));
        return { isQuickAction, cmds, exchangeSite, outStatus, minusDiceHero, siteCnt, minusDiceCard, minusDiceSkill, task }
    }
    /**
     * 状态效果发动
     * @param pidx 玩家idx
     * @param otypes 状态类型
     * @param otrigger 触发条件
     * @param options intvl 时间间隔, isQuickAction 是否有快速行动, isExec 是否执行, isOnlyFront 是否只执行出战角色, changeHeroDiceCnt 实际减少切换角色的骰子, heal 回血数,
     *                phase 当前最新阶段, callback 更新回调函数, players 最新玩家信息, hidxs 只执行某几个角色, hidx 用于指定角色(目前只用于断流),
     *                card 使用的卡, isOnlyInStatus 是否只执行角色状态, isOnlyOutStatus 是否只执行出战状态, heros 当前角色组,
     *                isSwitchAtk 是否切换攻击角色, taskMark 任务标记
     * @returns isQuickAction 是否有快速行动, minusDiceHero 减少切换角色的骰子,changeHeroDiceCnt 实际减少切换角色的骰子, cmds 要执行的命令, 
     *          statusIdsAndPidx 额外攻击, isInvalid 使用卡是否有效, minusDiceCard 使用卡减少骰子
    */
    _doStatus(pidx: number, otypes: number | number[], otrigger: Trigger | Trigger[],
        options: {
            intvl?: number[], isQuickAction?: boolean | number, isExec?: boolean, isOnlyFront?: boolean, changeHeroDiceCnt?: number, heal?: number[],
            phase?: number, callback?: () => void, players?: Player[], hidxs?: number[], hidx?: number,
            card?: Card, isOnlyInStatus?: boolean, isOnlyOutStatus?: boolean, heros?: Hero[], minusDiceCard?: number,
            dmgElement?: number, eheros?: Hero[], isUnshift?: boolean, isSwitchAtk?: boolean, taskMark?: number[],
        } = {}) {
        const types: number[] = [];
        const triggers: Trigger[] = [];
        if (typeof otypes == 'number') types.push(otypes);
        else types.push(...otypes);
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        let { isQuickAction: oiqa = 0, changeHeroDiceCnt = 0, minusDiceCard = 0 } = options;
        let isQuickAction = Number(oiqa);
        const { intvl, isExec = true, isOnlyFront = false, players = this.players, phase = this.player.phase, dmgElement = 0,
            callback = () => { }, hidxs, hidx: ophidx = -1, card, isOnlyInStatus = false, isOnlyOutStatus = false, heal = [0, 0, 0],
            isUnshift = false, isSwitchAtk = false, taskMark } = options;
        let addDiceHero = 0;
        let minusDiceHero = 0;
        let isInvalid = false;
        const cmds: Cmds[] = [];
        const statusIdsAndPidx: StatusTask[] = [];
        let readySkill = -1;
        let task: [(() => void)[], number[]] | undefined;
        if (isQuickAction == 1 || players.some(p => p.hidx < 0)) {
            return { isQuickAction: !!isQuickAction, addDiceHero, minusDiceHero, changeHeroDiceCnt, cmds, statusIdsAndPidx, task }
        }
        const p = players[pidx];
        const pheros = options.heros ?? p.heros;
        const peheros = options.eheros ?? players[p.pidx ^ 1].heros;
        const doStatus = (stses: Status[], group: number, hidx: number, trigger: Trigger) => {
            const nist: Status[] = [];
            const nost: Status[] = [];
            const nistop: Status[] = [];
            for (const sts of stses) {
                if (!sts.type.some(t => types.includes(t)) || (taskMark && (taskMark[0] != hidx || taskMark[1] != group || taskMark[2] != sts.id))) continue;
                const stsres = heroStatus(sts.id).handle(sts, {
                    heros: pheros,
                    eheros: peheros,
                    hidx,
                    trigger,
                    hidxs: [ophidx],
                    phase: p.pidx == this.playerIdx ? phase : p.phase,
                    card,
                    minusDiceCard,
                    heal,
                    dmgElement,
                });
                if (this._hasNotTrigger(stsres.trigger, trigger)) continue;
                if (group == 1) {
                    if (isQuickAction == 1 && stsres?.isQuickAction != undefined) continue;
                    if (isQuickAction < 2) isQuickAction = Number(stsres?.isQuickAction ?? false);
                }
                addDiceHero += stsres?.addDiceHero ?? 0;
                minusDiceHero += stsres?.minusDiceHero ?? 0;
                minusDiceCard += stsres?.minusDiceCard ?? 0;
                isInvalid ||= stsres?.isInvalid ?? false;
                if (sts.type.includes(1) && (stsres.damage || stsres.pendamage || stsres.heal) && !trigger.includes('phase')) {
                    statusIdsAndPidx.push({ id: sts.id, type: group, pidx: p.pidx, isOppo: 0, trigger, hidx, isQuickAction: isQuickAction == 2, isSwitchAtk });
                }
                if (isExec) {
                    const stsexecres = stsres?.exec?.(undefined, { hidx, changeHeroDiceCnt, minusDiceCard });
                    changeHeroDiceCnt = stsexecres?.changeHeroDiceCnt ?? 0;
                    nost.push(...(stsexecres?.outStatus ?? []));
                    nist.push(...(stsexecres?.inStatus ?? []));
                    nistop.push(...(stsexecres?.inStatusOppo ?? []));
                    const stscmds = [...(stsres?.cmds ?? []), ...(stsexecres?.cmds ?? [])];
                    if (stscmds.length > 0) {
                        cmds.push(...stscmds);
                        if (intvl) {
                            const tintvl = clone(intvl);
                            if (stsres?.damage || stsres?.pendamage) tintvl[2] = 2000;
                            if (!taskMark) {
                                const args = Array.from(arguments);
                                args[3] = clone(args[3]) ?? {};
                                args[3].taskMark = [hidx, group, sts.id];
                                this.taskQueue.addTask('status-' + sts.name, args, isUnshift);
                            } else {
                                const statusHandle = [
                                    () => { },
                                    () => { // 回血、伤害
                                        console.info(`[${p.name}]${trigger}:${sts.name}.useCnt:${sts.useCnt}->${sts.useCnt - 1}`);
                                        const opponent = this.players[p.pidx ^ 1];
                                        let aheros: Hero[] = this.players[p.pidx].heros;
                                        let eheros: Hero[] = opponent.heros;
                                        let asummon: Summonee[] | undefined;
                                        let esummon: Summonee[] | undefined;
                                        let willDamage: number[][] | undefined;
                                        let elTips: [string, number, number][] | undefined;
                                        let isOppo: boolean = stsres?.isOppo ?? false;
                                        let aWillAttach: number[][] | undefined;
                                        let aWillHeal: number[] = [-1, -1, -1, -1, -1, -1];
                                        let willAttachs: number[][] | undefined;
                                        let dmgElements: number[] = [0, 0, 0];
                                        const { heros, ndices, willHeals } = this._doCmds(stscmds, { pidx: p.pidx, hidxs: [hidx] });
                                        if (heros) aheros = heros;
                                        if (stsres?.damage || stsres?.pendamage) {
                                            if (asummon == undefined) asummon = this.players[p.pidx].summon;
                                            if (esummon == undefined) esummon = opponent.summon;
                                            const eFrontIdx = isOppo ? hidx : eheros?.findIndex(h => h.isFront);
                                            const apidx = isOppo ? opponent.pidx : p.pidx;
                                            const { willDamage: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, eheros: eheros1,
                                                summon: esummon1, aheros: aheros1, summonOppo: asummon1, elrcmds: elrcmds1, elTips: elTips1 }
                                                = this._elementReaction(
                                                    stsres?.element ?? 0,
                                                    [0, 0, 0].map((_, i) => [
                                                        i == eFrontIdx ? (stsres?.damage ?? -1) : -1,
                                                        stsres?.hidxs?.includes(i) || (i != eFrontIdx && stsres?.hidxs == undefined) ? (stsres?.pendamage ?? 0) : 0
                                                    ]),
                                                    eFrontIdx,
                                                    isOppo ? aheros : eheros,
                                                    isOppo ? asummon : esummon,
                                                    isOppo ? eheros : aheros,
                                                    isOppo ? esummon : asummon,
                                                    { pidx: apidx }
                                                );
                                            aheros = isOppo ? eheros1 : aheros1;
                                            eheros = isOppo ? aheros1 : eheros1;
                                            asummon = isOppo ? esummon1 : asummon1;
                                            esummon = isOppo ? asummon1 : esummon1;
                                            dmgElements = dmgElements1;
                                            aWillAttach = [[], [], [], [], [], []];
                                            for (let i = 0; i < 3; ++i) aWillAttach[i + (apidx ^ 1) * 3].push(willAttachs1[i]);
                                            if (p.pidx ^ (isOppo ? 1 : 0)) willDamage = [[-1, 0], [-1, 0], [-1, 0], ...willDamage1];
                                            else willDamage = [...willDamage1, [-1, 0], [-1, 0], [-1, 0]];
                                            stscmds.push(...elrcmds1[0]);
                                            elTips = elTips1;
                                            willAttachs = [[], [], [], [], [], []];
                                            willAttachs[eFrontIdx + (p.pidx ^ (isOppo ? 0 : 1)) * 3].push(stsres?.element ?? 0);
                                        }
                                        if (stsres?.heal) {
                                            const stshl = stsres.heal ?? 0;
                                            (stsres?.hidxs ?? [isOppo ? eheros?.findIndex(h => h.isFront) : hidx]).forEach((hli: number) => {
                                                const hlhidx = hli + 3 * (p.pidx ^ (isOppo ? 0 : 1));
                                                if (aWillHeal[hlhidx] < 0) aWillHeal[hlhidx] = stshl;
                                                else aWillHeal[hlhidx] += stshl;
                                            });
                                        }
                                        const curStatus = (group == 0 ? aheros[hidx].inStatus : aheros[hidx].outStatus).find(s => s.id == sts.id);
                                        if (!curStatus) throw new Error(`[${p.name}]${aheros[hidx].name}:${sts.name} status not found`);
                                        stsres?.exec?.(curStatus);
                                        const heal = (willHeals ?? aWillHeal).slice(3 - p.pidx * 3, 6 - p.pidx * 3).map(v => Math.max(0, v) % 100);
                                        if (heal.some(hl => hl > 0)) {
                                            this._doSlot('heal', { pidx: p.pidx, hidxs: allHidxs(p.heros, { isAll: true }), heal });
                                            this._doStatus(p.pidx, 4, 'heal', { heal });
                                        }
                                        this.socket.emit('sendToServer', {
                                            cpidx: p.pidx,
                                            currStatus: curStatus,
                                            hidx,
                                            statuscmd: [stscmds, group],
                                            willDamage,
                                            willAttachs,
                                            dmgElements,
                                            willHeals: isCdt(aWillHeal.some(v => v > -1), aWillHeal),
                                            heros: aheros,
                                            eheros,
                                            summonee: asummon,
                                            esummon,
                                            elTips,
                                            dices: ndices,
                                            playerInfo: this.players[p.pidx].playerInfo,
                                            isEndAtk: this.taskQueue.isTaskEmpty(),
                                            flag: `_doStatus-${group == 0 ? 'in' : 'out'}Status-task-${curStatus.name}-${p.pidx}`,
                                        });
                                    },
                                    () => { },
                                    () => { }
                                ];
                                task = [statusHandle, tintvl];
                            }
                        } else if (stsexecres?.immediate) {
                            const { ndices, heros } = this._doCmds(stscmds, { pidx: p.pidx });
                            if (heros) players[p.pidx].heros = heros;
                            this.socket.emit('sendToServer', {
                                cpidx: p.pidx,
                                heros: heros ?? pheros,
                                dices: ndices,
                                cmds: stsres.cmds,
                                flag: `_doStatus-${['in', 'out'][group]}Status-immediate-${sts.name}-${p.pidx}`,
                            });
                        }
                    }
                    if (trigger == 'useReadySkill') {
                        this.canAction = false;
                        readySkill = stsres?.skill ?? -1;
                    }
                }
            }
            return { nist, nost, nistop }
        }
        for (let i = 0; i < pheros.length; ++i) {
            const hidx = (i + p.hidx) % pheros.length;
            let h = pheros[hidx];
            if ((hidxs == undefined || hidxs.includes(hidx)) && (h.isFront || (!isOnlyOutStatus && !isOnlyFront))) {
                for (const trigger of triggers) {
                    if (!isOnlyOutStatus) {
                        const { nist, nistop } = doStatus(h.inStatus, 0, hidx, trigger);
                        if (isExec) {
                            const { nstatus: aist, nheros: ah } = this._updateStatus(nist, h.inStatus, pheros, hidx);
                            h.inStatus = aist;
                            if (ah) {
                                pheros[hidx] = ah[hidx];
                                pheros[hidx].inStatus = aist;
                                h = ah[hidx];
                            }
                            const ehidx = peheros.findIndex(h => h.isFront);
                            if (ehidx > -1) {
                                const { nstatus: eist, nheros: eh } = this._updateStatus(nistop, peheros[ehidx].inStatus, peheros, ehidx);
                                if (eh) {
                                    eh[ehidx].inStatus = eist;
                                    peheros[ehidx] = eh[ehidx];
                                }
                            }
                        }
                    }
                    if (h.isFront && !isOnlyInStatus) {
                        const { nost } = doStatus(h.outStatus, 1, hidx, trigger);
                        if (isExec) h.outStatus = this._updateStatus(nost, h.outStatus).nstatus;
                    }
                }
            }
        }
        if (isExec && !taskMark) this.taskQueue.addStatusId(statusIdsAndPidx);
        if (readySkill > -1) setTimeout(() => this.useSkill(readySkill, { isReadySkill: true }, callback), 1200);
        return { isQuickAction: !!isQuickAction, addDiceHero, minusDiceHero, changeHeroDiceCnt, cmds, statusIdsAndPidx, isInvalid, minusDiceCard, task }
    }
    /**
     * 是否有阵亡
     * @returns 是否有阵亡
     */
    _hasNotDieChange() {
        return this.players.findIndex(p => [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(p.phase)) == -1;
    }
    /**
     * 进行额外的攻击
     */
    _doAddAtk(stsTask: StatusTask, isDieChangeBack = false) {
        return new Promise<boolean>(async resolve => {
            if (!isDieChangeBack) await this._delay(2300);
            if (!this._hasNotDieChange() || !this.taskQueue.isExecuting) {
                resolve(false);
                return;
            }
            const { id: sid, type: stype, pidx, isOppo = 0, trigger = '', hidx: ohidx = this.players[pidx].hidx,
                isSwitchAtk: isa = false, isQuickAction = false, isAfterSwitch = false } = stsTask;
            if (isAfterSwitch) await this._delay(2300);
            let { heros: aheros, hidx: ahidx, summon: aSummon } = this.players[pidx];
            let { heros: eheros, hidx: eFrontIdx, summon: eSummon } = this.players[pidx ^ 1];
            ahidx = stype == 1 ? ahidx : ohidx;
            const frontHero = aheros[ahidx];
            const eFrontHero = eheros[eFrontIdx];
            const slots = [frontHero.artifactSlot, frontHero.talentSlot, frontHero.weaponSlot];
            const handleres = stype == 0 ?
                heroStatus(sid).handle((isOppo ? eFrontHero : frontHero).inStatus
                    .find(ist3 => ist3.id == sid) ?? heroStatus(sid), {
                    heros: isOppo ? eheros : aheros,
                    eheros: isOppo ? aheros : eheros,
                    trigger: trigger as Trigger,
                    hidx: isOppo ? eFrontIdx : ahidx,
                }) :
                heroStatus(sid).handle((isOppo ? eFrontHero : frontHero).outStatus
                    .find(ost3 => ost3.id == sid) ?? heroStatus(sid), {
                    heros: isOppo ? eheros : aheros,
                    eheros: isOppo ? aheros : eheros,
                    trigger: trigger as Trigger,
                    hidx: isOppo ? eFrontIdx : ahidx,
                });
            let { willDamage, willAttachs: willAttachs1, dmgElements, eheros: eheros1, summon: esummon, aheros: aheros1, summonOppo, elrcmds, elTips }
                = this._elementReaction(
                    handleres?.element ?? 0,
                    [0, 0, 0].map((_, i) => [
                        i == eFrontIdx ? (handleres?.damage ?? -1) : -1,
                        (handleres?.hidxs?.includes(i) || (i != eFrontIdx && handleres?.hidxs == undefined)) ? (handleres?.pendamage ?? 0) : 0
                    ]),
                    eFrontIdx,
                    eheros, eSummon,
                    aheros, aSummon,
                    { pidx }
                );
            const { cmds: execmds = [] } = handleres?.exec?.(stype < 2 ? ((stype == 0 ? (isOppo ? eheros1[eFrontIdx].inStatus : aheros1[ahidx].inStatus) :
                (isOppo ? eheros1[eFrontIdx].outStatus : aheros1[ahidx].outStatus)).find(sts3 => sts3.id == sid)) :
                slots.find(slot => slot?.id == sid), { heros: isOppo ? eheros1 : aheros1 }) ?? {};
            if (pidx == 0) this.willDamages = [...clone(willDamage), [-1, 0], [-1, 0], [-1, 0]];
            else this.willDamages = [[-1, 0], [-1, 0], [-1, 0], ...clone(willDamage)];
            const aWillAttach: number[][] = [[], [], [], [], [], []];
            for (let i = 0; i < 3; ++i) aWillAttach[i + (pidx ^ 1) * 3].push(willAttachs1[i]);
            let willHeals: number[] | undefined;
            const cmds = [...(handleres?.cmds ?? []), ...(execmds ?? [])];
            let dices;
            if (cmds.length > 0) {
                const { willHeals: cmdheal, ndices, heros } = this._doCmds(cmds, { pidx, heros: aheros1 });
                willHeals = cmdheal;
                dices = ndices;
                if (heros) aheros1 = heros;
            }
            if (handleres?.heal) {
                const heals = [0, 0, 0].map((_, hi) => {
                    return (handleres?.hidxs?.includes(hi) || handleres?.hidxs == undefined && ahidx == hi) ? (handleres.heal ?? 0) : -1;
                });
                if (willHeals == undefined) willHeals = [-1, -1, -1, -1, -1, -1];
                for (let i = 0; i < 3; ++i) {
                    if (heals[i] < 0) continue;
                    const hlidx = i + (pidx ^ 1) * 3;
                    if (willHeals[hlidx] < 0) willHeals[hlidx] = heals[i];
                    else willHeals[hlidx] += heals[i];
                }
            }
            const heal = willHeals?.slice(3 - pidx * 3, 6 - pidx * 3).map(v => Math.max(0, v) % 100);
            if (heal?.some(hl => hl > 0)) {
                this._doSlot('heal', { pidx, hidxs: allHidxs(aheros, { isAll: true }), heal });
                this._doStatus(pidx, 4, 'heal', { heal });
            }
            const statusIdsAndPidx: StatusTask[] = [];
            const triggers: Trigger[] = ['status-destroy'];
            eheros1[eFrontIdx].outStatus.forEach(ost => {
                if (ost.id != sid && ost.type.includes(1)) {
                    for (const trg of triggers) {
                        const ostres = heroStatus(ost.id).handle(ost, { heros: eheros1, hidx: eFrontIdx, trigger: trg });
                        if (ostres?.trigger?.includes(trg) && (ostres.damage || ostres.pendamage || ostres.heal)) {
                            const ostIsOppo = ostres?.isOppo ? 1 : 0;
                            statusIdsAndPidx.push({ id: ost.id, type: stype, pidx: pidx ^ ostIsOppo ^ 1, isOppo: ostIsOppo, trigger: trg });
                        }
                    }
                }
            });
            this.taskQueue.addStatusId(statusIdsAndPidx, true);
            let isSwitchAtk = false;
            if (elrcmds[0].some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'))) {
                const { statusIdsAndPidx: stpidx } = this._doStatus(pidx ^ 1, 1, 'change-from', { hidxs: [eFrontIdx] });
                if (stpidx.length > 0) isSwitchAtk = true;
            }
            let isSwitchAtking = false;
            ;
            if (isa) isSwitchAtking = (this.taskQueue.queue.find(t => t[0].startsWith('addAtk'))?.[1] as StatusTask)?.isSwitchAtk ?? false;
            const willAttachs: number[][] = [[], [], [], [], [], []];
            willAttachs[eFrontIdx + (pidx ^ 1) * 3].push(handleres?.element ?? 0);
            this.socket.emit('sendToServer', {
                statusId: stype < 2 ? [sid, stype, isOppo, ahidx, isSwitchAtking, isQuickAction] : [],
                cpidx: pidx,
                summonee: summonOppo,
                heros: aheros1,
                eheros: eheros1,
                esummon,
                willDamage: this.willDamages,
                willAttachs,
                dmgElements,
                elTips,
                willHeals,
                dices,
                cmds: [...elrcmds[0], ...cmds],
                playerInfo: this.players[pidx].playerInfo,
                isEndAtk: this.taskQueue.isTaskEmpty() && !isSwitchAtk && !isa,
                flag: `_doAddAtk-${sid}-${pidx}`,
            });
            resolve(true);
        });
    }
    /**
    * 被动技能发动
    * @param hidx 发动技能角色的索引idx
    * @param trigger 触发的时机
    * @param options pidx 玩家idx, heros 角色组, eheros 敌方角色组, isExec 是否执行, dmg 伤害数
    * @returns 变化的res { isQuickAction: 是否为快速行动, inStatus: 发动技能角色的角色状态, heros 变化后的角色组 }
    */
    _doSkill5(hidx: number, otrigger: Trigger | Trigger[],
        options: { pidx?: number, heros?: Hero[], eheros?: Hero[], isExec?: boolean, dmg?: number } = {}
    ) {
        if (hidx < 0) return { isQuickAction: false, inStatus: [], heros: [] }
        const { pidx = this.playerIdx, isExec = true, dmg = 0 } = options;
        let { heros = this.players[pidx].heros, eheros = this.players[pidx ^ 1].heros } = options;
        const hero = heros[hidx];
        let isQuickAction = false;
        let inStatus: Status[] = clone(hero.inStatus);
        const skills = herosTotal(hero.id).skills;
        const skill5s = skills.filter(sk => sk.type == 4);
        const triggers: Trigger[] = [];
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        for (const skill5 of skill5s) {
            const skillres = skill5?.handle({ hero, skidx: skills.findIndex(sk => sk.name == skill5.name), dmg });
            for (const trigger of triggers) {
                if (!skillres?.trigger?.includes(trigger)) continue;
                if (skillres?.inStatus) {
                    const { nstatus, nheros } = this._updateStatus(skillres.inStatus, inStatus, heros, hidx);
                    if (nheros) {
                        inStatus = nstatus;
                        nheros[hidx].inStatus = [...nstatus];
                        heros[hidx] = nheros[hidx];
                    }
                }
                if (skillres?.isQuickAction) isQuickAction = true;
                if (skillres?.cmds) {
                    const { heros: ch } = this._doCmds(skillres.cmds, { pidx, heros, isExec });
                    if (ch) heros = ch;
                }
                if (isExec) skillres?.exec?.();
            }
        }
        if (hidx == heros.findIndex(h => h.isFront)) {
            const ostop: Status[] = [];
            for (let i = 0; i < eheros.length; ++i) {
                const ehero = eheros[i];
                if (ehero.hp <= 0) continue;
                const eskills = herosTotal(ehero.id).skills;
                const eskill5s = eskills.filter(sk => sk.type == 4);
                for (const eskill5 of eskill5s) {
                    const skilloppores = eskill5?.handle({ hero: ehero, skidx: 5 });
                    for (const trg of triggers) {
                        if (!skilloppores?.trigger?.includes(trg)) continue;
                        ostop.push(...(skilloppores?.outStatusOppo ?? []));
                    }
                }
            }
            if (ostop.length > 0) {
                const { nstatus, nheros } = this._updateStatus(ostop, heros[hidx].outStatus, heros);
                if (nheros) {
                    nheros[hidx].outStatus = [...nstatus];
                    heros[hidx] = nheros[hidx];
                }
            }
        }
        return { isQuickAction, inStatus, heros };
    }
    /**
     * 检测装备栏
     * @param triggers 触发时机
     * @param options 配置项: isOnlyRead 是否只读, pidx 玩家索引, hidxs 当前角色索引, summons 当前玩家召唤物, changeHeroDiceCnt 切换角色需要骰子,
     *                        heal 回血量, heros 我方角色组, eheros 敌方角色组, hcard 使用的牌, isChargedAtk 是否为重击, isSkill 使用技能的idx, taskMark 任务标记,
     *                        isFallAtk 是否为下落攻击, isExec 是否执行task(配合新heros), intvl 间隔时间, dieChangeBack 是否为死后切换角色, card 可能要装备的卡,
     *                        usedDice 使用的骰子数, ehidx 被攻击角色的idx, minusDiceCard 用卡减骰子, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列
     * @returns willHeals 将要回血, pidx 玩家索引, changeHeroDiceCnt 切换角色需要骰子, addDmg 条件加伤, inStatus 新增角色状态, outStatus 新增出战状态
     *          addDmgSummon 召唤物加伤, summon 新出的召唤物, isEndAtk 是否结束攻击, minusDiceSkill 用技能减骰子
     */
    _doSlot(otriggers: Trigger | Trigger[], options: {
        pidx?: number, hidxs?: number | number[], summons?: Summonee[], ehidx?: number, card?: Card | null, taskMark?: number[],
        changeHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[], minusDiceCard?: number,
        hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, isSkill?: number, minusDiceSkill?: number[][],
        isExec?: boolean, intvl?: number[], dieChangeBack?: boolean, usedDice?: number, isEndAtk?: boolean,
    } = {}) {
        const triggers: Trigger[] = [];
        if (typeof otriggers == 'string') triggers.push(otriggers);
        else triggers.push(...otriggers);
        const { pidx = this.playerIdx, summons = this.players[pidx].summon, heal = [0, 0, 0], hcard, ehidx = -1,
            heros = this.players[pidx].heros, eheros = this.players[pidx ^ 1].heros, taskMark,
            isChargedAtk = false, isFallAtk = this.isFall, isExec = true, intvl, card,
            dieChangeBack = false, isSkill = -1, usedDice = 0 } = options;
        let { changeHeroDiceCnt = 0, minusDiceCard = 0, hidxs = [this.players[pidx].hidx], minusDiceSkill, isEndAtk: oisEndAtk = true } = options;
        const slotIds: [number, Card][][] = [[], [], []];
        let willHeals: number[] = [-1, -1, -1];
        let addDmg = 0;
        let addDmgSummon = 0;
        let inStatus: Status[] | undefined;
        let outStatus: Status[] | undefined;
        let summon: Summonee[] | undefined;
        let minusDiceHero = 0;
        let task: [(() => void)[], number[]] | undefined;
        if (typeof hidxs == 'number') {
            if (hidxs < 0) hidxs = [];
            else hidxs = [hidxs];
        } else {
            const ahidx = this.players[pidx].hidx;
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        }
        for (const hidx of hidxs) {
            if (taskMark && taskMark[0] != hidx) continue;
            const fHero = heros[hidx];
            const slots = [fHero.weaponSlot, fHero.artifactSlot, fHero.talentSlot];
            const cmds: Cmds[][] = [];
            if (card?.type == 0 && slots.every(slot => slot?.id != card.id)) slots.push(card);
            slots.forEach(slot => {
                if (slot != null && (!taskMark || slot.subType.includes(taskMark[1]))) {
                    for (const trigger of triggers) {
                        const slotres = cardsTotal(slot.id).handle(slot, {
                            heros,
                            hidxs: [hidx],
                            eheros,
                            ehidx,
                            summons,
                            trigger,
                            changeHeroDiceCnt,
                            hcard,
                            heal,
                            isChargedAtk,
                            isFallAtk,
                            hcardsCnt: this.handCards.length,
                            dicesCnt: this.player.dice.length - usedDice,
                            isSkill,
                            isExec,
                            minusDiceCard,
                            minusDiceSkill,
                        });
                        if (this._hasNotTrigger(slotres.trigger, trigger)) continue;
                        if (slotres?.execmds && isExec) {
                            cmds.push(slotres.execmds);
                            slotIds[hidx].push([hidx, slot]);
                        }
                        if (isExec && (!slotres?.execmds?.length || taskMark)) {
                            const slotexecres = slotres?.exec?.();
                            if (slotexecres?.inStatus) {
                                if (inStatus == undefined) inStatus = [...slotexecres.inStatus];
                                else inStatus.push(...slotexecres.inStatus);
                            }
                            if (slotexecres?.outStatus) {
                                if (outStatus == undefined) outStatus = [...slotexecres.outStatus];
                                else outStatus.push(...slotexecres.outStatus);
                            }
                            if (slotexecres?.inStatusOppo) {
                                const ehidxs = slotexecres?.hidxs ?? [eheros.findIndex(h => h.isFront)];
                                for (const ehidx of ehidxs) {
                                    eheros[ehidx].inStatus = this._updateStatus(slotexecres.inStatusOppo, eheros[ehidx].inStatus).nstatus;
                                }
                            }
                            if (slotexecres?.outStatusOppo) {
                                eheros[this.players[pidx ^ 1].hidx].outStatus = this._updateStatus(slotexecres.outStatusOppo, eheros[this.players[pidx ^ 1].hidx].outStatus).nstatus;
                            }
                        }
                        changeHeroDiceCnt -= slotres?.minusDiceHero ?? 0;
                        minusDiceHero += slotres?.minusDiceHero ?? 0;
                        minusDiceCard += slotres?.minusDiceCard ?? 0;
                        addDmg += slotres?.addDmgCdt ?? 0;
                        addDmgSummon += slotres?.addDmgSummon ?? 0;
                        minusDiceSkill = slotres?.minusDiceSkill ?? minusDiceSkill;
                        if (slotres?.execmds?.some(cmds => cmds.cmd == 'heal') && !isExec) {
                            const { cnt: heal = -1, hidxs } = slotres.execmds.find(cmds => cmds.cmd == 'heal') ?? {};
                            willHeals.forEach((v, i, a) => {
                                if (hidxs?.includes(i) || (hidxs == undefined && fHero.isFront && hidx == i)) {
                                    if (v < 0) a[i] = heal;
                                    else a[i] += heal;
                                }
                            });
                        }
                        if (slotres?.summon) {
                            if (summon == undefined) summon = [...slotres.summon];
                            else summon.push(...slotres.summon);
                        }
                        if (slotres?.inStatusOppo) {
                            const ehidxs = slotres?.hidxs ?? [eheros.findIndex(h => h.isFront)];
                            for (const hidx of ehidxs) {
                                eheros[hidx].inStatus = this._updateStatus(slotres.inStatusOppo, eheros[hidx].inStatus).nstatus;
                            }
                        }
                    }
                }
            });
            for (let i = 0; i < cmds.length; ++i) {
                const useSkillIdx = cmds[i].findIndex(v => v.cmd == 'useSkill');
                if (useSkillIdx > -1) cmds[i].splice(useSkillIdx, 1);
                if (cmds[i].length == 0) continue;
                if (isExec) {
                    if (!taskMark) {
                        const args = Array.from(arguments);
                        args[1] = clone(args[1]) ?? {};
                        args[1].pidx = pidx;
                        args[1].taskMark = [hidx, slotIds[hidx][i][1].subType[0]];
                        this.taskQueue.addTask('slot', args);
                    } else {
                        const slotHandle = [
                            () => { },
                            (isEndAtk = false) => {
                                let nheros: Hero[] = this.players[pidx].heros;
                                const { ndices, heros: nh, inStatus: nist, willHeals } = this._doCmds(cmds[i], { pidx, heros: nheros });
                                if (nh) nheros = nh;
                                if (nist) nheros[hidx].inStatus = nist;
                                if (inStatus) {
                                    nheros[hidx].inStatus = this._updateStatus(inStatus, nheros[hidx].inStatus).nstatus;
                                }
                                if (outStatus) {
                                    nheros[hidx].outStatus = this._updateStatus(outStatus, nheros[hidx].outStatus).nstatus;
                                }
                                const heal = willHeals?.slice(3 - pidx * 3, 6 - pidx * 3).map(v => Math.max(0, v) % 100);
                                if (heal?.some(hl => hl > 0)) {
                                    this._doSlot('heal', { pidx, hidxs: allHidxs(nheros, { isAll: true }), heal });
                                    this._doStatus(pidx, 4, 'heal', { heal });
                                }
                                this.socket.emit('sendToServer', {
                                    cpidx: pidx,
                                    slotres: { cmds: cmds[i], slotIds: slotIds[hidx][i] },
                                    heros: nheros,
                                    eheros: this.players[pidx ^ 1].heros,
                                    dices: ndices,
                                    hidx,
                                    isEndAtk: isEndAtk && oisEndAtk && !dieChangeBack,
                                    flag: `_doSlot-${slotIds[hidx][i][1].name}-${pidx}`,
                                });
                            },
                            () => { },
                            () => { },
                        ];
                        task = [slotHandle, intvl ?? [300, 500, 1200, 300]];
                    }
                }
            }
        }
        return {
            willHeals, pidx, changeHeroDiceCnt, addDmg, addDmgSummon, inStatus, outStatus,
            minusDiceHero, summon, isEndAtk: oisEndAtk, minusDiceCard, minusDiceSkill, task,
        };
    }
    /**
     * 执行命令集
     * @param cmds 命令集
     * @param callback 回调函数
     * @param options isCard 是否为使用卡, hidxs 角色索引组, pidx 执行命令玩家idx, isOnlyRead 是否只读, heal 回血量, isExec 是否要去掉已选择的骰子, heros 角色组
     * @returns ndices 骰子, phase 阶段, heros 角色组, inStatus 获得角色状态, willHeals 回血组, changedEl 变化元素
     */
    _doCmds(cmds?: Cmds[],
        options: {
            isCard?: boolean, hidxs?: number[], pidx?: number, isOnlyRead?: boolean,
            heal?: number, isExec?: boolean, heros?: Hero[], callback?: () => void,
        } = {}
    ) {
        const { isCard = false, hidxs: chidxs, pidx = this.playerIdx, callback,
            isOnlyRead = false, heal = 0, isExec = true, heros: ocheros } = options;
        const player = this.players[pidx];
        const cheros = ocheros ?? player.heros;
        const dices = player.dice.filter((_, i) => !isExec || !player.diceSelect[i]).map(v => ({ val: v, isSelected: false }));
        let ndices = this.rollDice(dices, { pidx, frontIdx: player.hidx, isExec });
        if (cmds == undefined || cmds.length == 0) return { ndices };
        let isSwitch: number = cheros.findIndex(h => h.isSelected > 0);
        let isSwitchOppo: number = -1;
        let phase: number | undefined;
        let heros: Hero[] | undefined;
        let inStatus: Status[] | undefined;
        let outStatus: Status[] | undefined;
        let willHeals: number[] | undefined;
        let changedEl: number | undefined;
        for (let i = 0; i < cmds.length; ++i) {
            const { cmd = '', cnt = 0, element = 0, isReadySkill = false, status: getstatus = [], card } = cmds[i];
            let { hidxs } = cmds[i];
            if (!hidxs && chidxs) {
                cmds[i].hidxs = [...chidxs];
                hidxs = cmds[i].hidxs;
            }
            if (cmd == 'useSkill') {
                if (callback) this.useSkill(cnt, { isOnlyRead, isCard, isSwitch, isReadySkill }, callback);
            } else if (cmd?.startsWith('switch-')) {
                if (isSwitch == -1) isSwitch = hidxs?.[0] ?? -1;
                if (!isExec) {
                    this.willSwitch = [false, false, false, false, false, false];
                    let sdir = 0;
                    if (cmd.startsWith('switch-before')) sdir = -1;
                    else if (cmd.startsWith('switch-after')) sdir = 1;
                    const cpidx = cmd.endsWith('self') ? pidx : (pidx ^ 1);
                    const heros = this.players[cpidx].heros;
                    const hLen = heros.filter(h => h.hp > 0).length;
                    const livehidxs: number[] = allHidxs(heros);
                    let nhidx = -1;
                    if (sdir == 0) {
                        nhidx = getNearestHidx(hidxs?.[0] ?? -1, heros);
                    } else {
                        nhidx = livehidxs[(heros.findIndex(h => h.isFront) + sdir + hLen) % hLen];
                    }
                    this.willSwitch[cpidx * 3 + nhidx] = true;
                    if (!cmd.endsWith('self')) isSwitchOppo = nhidx;
                    else if (isSwitch == -1) isSwitch = nhidx;
                    else if (!cmds.some(cmds => cmds.cmd == 'useSkill')) this.useSkill(-1, { isOnlyRead: true });
                }
            } else if (cmd == 'getCard') {
                if (card) {
                    const cards = Array.isArray(card) ? card : [card];
                    if (cards.some(c => typeof c == 'number')) {
                        cmds[i].card = cards.map(c => cardsTotal(c as number));
                    }
                }
            } else if (cmd == 'getDice' && isExec) {
                ndices = this._getDice(dices, cnt, element, { pidx });
            } else if (cmd == 'getEnergy' && isExec) {
                heros = cheros;
                heros.forEach((h, hi) => {
                    if (h.hp > 0 && (hidxs == undefined && h.isFront || hidxs?.includes(hi))) {
                        h.energy = Math.max(0, Math.min(h.maxEnergy, h.energy + cnt));
                    }
                });
            } else if (cmd == 'reroll' && (ndices?.val.length ?? 0) > 0 && isExec) {
                phase = PHASE.DICE;
                this.rollCnt = cnt;
                this.showRerollBtn = true;
            } else if (cmd == 'changeDice' && isExec) {
                ndices = this._getDice([], dices.length, element);
            } else if (cmd == 'changeCard' && isExec) {
                setTimeout(() => {
                    this.socket.emit('sendToServer', {
                        phase: PHASE.CHANGE_CARD,
                        flag: 'useCard-changeCard-' + player.pidx,
                    });
                }, cnt || 100);
            } else if (cmd == 'getInStatus') {
                (hidxs ?? [player.hidx]).forEach(fhidx => {
                    const fhero = (heros ?? cheros)[fhidx];
                    const { nstatus, nheros } = this._updateStatus(getstatus, fhero.inStatus, heros ?? cheros, fhidx);
                    inStatus = nstatus;
                    if (nheros) heros = nheros;
                    if (heros) heros[fhidx].inStatus = [...nstatus];
                });
            } else if (cmd == 'getOutStatus') {
                const fhidx = player.hidx;
                const fhero = (heros ?? cheros)[fhidx];
                const { nstatus, nheros } = this._updateStatus(getstatus, fhero.outStatus, heros ?? cheros, fhidx);
                outStatus = nstatus;
                if (nheros) heros = nheros;
                if (heros) heros[fhidx].outStatus = [...nstatus];
            } else if (['heal', 'revive'].includes(cmd)) {
                const willHeals1 = [0, 0, 0].map((_, hi) => {
                    return (hidxs?.includes(hi) || hidxs == undefined && player.hidx == hi) ? (cnt || heal) : -1;
                });
                if (player.pidx == 1) willHeals = [...willHeals1, -1, -1, -1];
                else willHeals = [-1, -1, -1, ...willHeals1];
                if (cnt == 0) cmds[i].cnt = heal;
                (cmds[i].hidxs ?? []).forEach(hidx => {
                    const { heros: sk5h } = this._doSkill5(hidx, 'revive', { pidx, heros: heros ?? cheros });
                    heros = sk5h;
                });
            } else if (cmd == 'changeElement') {
                changedEl = element as number;
            } else if (cmd == 'changePattern') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                const newPattern = herosTotal(cnt);
                heros = heros ?? cheros;
                const { inStatus, outStatus, hp, isFront, talentSlot, artifactSlot, weaponSlot, energy } = heros[hidxs[0]];
                heros[hidxs[0]] = newPattern;
                heros[hidxs[0]].inStatus = [...inStatus];
                heros[hidxs[0]].outStatus = [...outStatus];
                heros[hidxs[0]].hp = hp;
                heros[hidxs[0]].isFront = isFront;
                heros[hidxs[0]].talentSlot = talentSlot;
                heros[hidxs[0]].artifactSlot = artifactSlot;
                heros[hidxs[0]].weaponSlot = weaponSlot;
                heros[hidxs[0]].energy = energy;
            } else if (cmd == 'getSkill') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                heros = heros ?? cheros;
                heros[hidxs[0]].skills.splice(element as number, 0, readySkill(cnt));
            } else if (cmd == 'loseSkill') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                heros = heros ?? cheros;
                heros[hidxs[0]].skills.splice(element as number, 1);
            }
        }
        return { ndices, phase, heros, inStatus, outStatus, willHeals, changedEl, isSwitch, isSwitchOppo }
    }
    /**
    * 计算变化的伤害和骰子消耗
    * @param pidx 玩家识别符: 0对方 1我方
    * @param hidx 角色索引idx
    * @param options isUpdateHandcards 是否更新手牌, isSwitch 是否为切换角色
    */
    _calcSkillChange(pidx: number, hidx: number, options: { isUpdateHandcards?: boolean, isSwitch?: boolean } = {}) {
        const plidx = this.playerIdx ^ pidx ^ 1;
        const { isUpdateHandcards = true, isSwitch = false } = options;
        const heros: Hero[] = (!isSwitch ? this.players[plidx] : clone(this.players[plidx])).heros;
        if (isSwitch) this._doSkill5(hidx, 'change-to', { heros });
        const curHero = heros[hidx];
        if (!curHero) return this.wrap(this.players[plidx], { isUpdateHandcards });
        const dmgChange = curHero.skills.filter(sk => sk.type < 4).map(() => 0);
        const costChange = curHero.skills.filter(sk => sk.type < 4).map(() => new Array(2).fill(0));
        let mds: number[][] = [];
        const calcDmgChange = (res: any) => {
            dmgChange.forEach((_, i, a) => {
                const curSkill = curHero.skills[i];
                a[i] += (res?.addDmg ?? 0) + (res?.[`addDmgType${curSkill.type}`] ?? 0);
            });
        }
        const calcCostChange = (res: any) => {
            mds = res?.minusDiceSkill ?? mds;
            costChange.forEach((v, i) => {
                const curSkill = curHero.skills[i];
                if (curSkill.type < 4) {
                    v[0] += res?.minusDiceSkills?.[i]?.[0] ?? 0;
                    v[1] += res?.minusDiceSkills?.[i]?.[1] ?? 0;
                }
            });
        }
        for (const curSkill of curHero.skills) {
            if (curSkill.type == 4) continue;
            mds.push(curSkill.cost.toString().padStart(2, '0').split('').map(Number));
        }
        [curHero.weaponSlot, curHero.talentSlot, curHero.artifactSlot].forEach(slot => {
            if (slot != null) {
                const slotres = cardsTotal(slot.id).handle(slot, {
                    heros,
                    hidxs: [hidx],
                    isChargedAtk: (this.players[plidx].dice.length & 1) == 0,
                    minusDiceSkill: mds,
                    trigger: 'calc',
                });
                calcDmgChange(slotres);
                calcCostChange(slotres);
            }
        });
        curHero.inStatus.forEach(ist => {
            const istres = heroStatus(ist.id).handle(ist, {
                heros,
                eheros: this.players[plidx ^ 1].heros,
                hidx,
                isChargedAtk: (this.player.dice.length & 1) == 0,
                minusDiceSkill: mds,
                trigger: 'calc',
            });
            calcDmgChange(istres);
            calcCostChange(istres);
        });
        (isSwitch ? heros.find(h => h.isFront) : curHero)?.outStatus.forEach(ost => {
            const ostres = heroStatus(ost.id).handle(ost, {
                heros,
                eheros: this.players[plidx ^ 1].heros,
                hidx,
                isChargedAtk: (this.player.dice.length & 1) == 0,
                minusDiceSkill: mds,
                trigger: 'calc',
            });
            calcDmgChange(ostres);
            calcCostChange(ostres);
        });
        this.players[plidx].summon.forEach(smn => {
            const smnres = newSummonee(smn.id).handle(smn, {
                heros,
                hidxs: [hidx],
                isFallAtk: this.isFall,
                minusDiceSkill: mds,
                trigger: 'calc',
            });
            calcDmgChange(smnres);
            calcCostChange(smnres);
        });
        this.players[plidx].site.forEach(site => {
            const siteres = newSite(site.id).handle(site, {
                heros,
                hidxs: [hidx],
                dices: this.players[plidx].dice,
                hcards: this.players[plidx].handCards,
                minusDiceSkill: mds,
                trigger: 'calc',
            });
            calcDmgChange(siteres);
            calcCostChange(siteres);
        });
        for (let i = 0; i < curHero.skills.length; ++i) {
            const curSkill = curHero.skills[i];
            if (curSkill.type == 4) continue;
            const skillres = (curSkill.rdskidx == -1 ? herosTotal(curHero.id).skills[i] : readySkill(curSkill.rdskidx)).handle({ hero: curHero, skidx: 5 });
            curSkill.costChange = [...costChange[i]];
            calcDmgChange(skillres);
            curSkill.dmgChange = dmgChange[i];
        }
        return this.wrap(this.players[plidx], { isUpdateHandcards, hero: isCdt(isSwitch, heros[hidx]) });
    }
    /**
     * 计算卡牌的变化骰子消耗
     */
    _clacCardChange() {
        const costChange = this.handCards.map(() => 0);
        const player = this.players[this.playerIdx];
        const curHero = player?.heros[player?.hidx];
        if (!curHero) return;
        this.handCards.forEach((c, ci) => {
            player.heros.forEach(h => {
                if (h.artifactSlot != null) {
                    costChange[ci] += cardsTotal(h.artifactSlot.id).handle(h.artifactSlot, {
                        heros: [h],
                        hidxs: [0],
                        hcard: c,
                        minusDiceCard: costChange[ci],
                    })?.minusDiceCard ?? 0;
                }
                if (h.weaponSlot != null) {
                    costChange[ci] += cardsTotal(h.weaponSlot.id).handle(h.weaponSlot, {
                        heros: [h],
                        hidxs: [0],
                        hcard: c,
                        minusDiceCard: costChange[ci],
                    })?.minusDiceCard ?? 0;
                }
            });
            curHero.inStatus.forEach(ist => {
                costChange[ci] += heroStatus(ist.id).handle(ist, {
                    heros: player.heros,
                    hidx: player.hidx,
                    card: c,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
            curHero.outStatus.forEach(ost => {
                costChange[ci] += heroStatus(ost.id).handle(ost, {
                    heros: player.heros,
                    hidx: player.hidx,
                    card: c,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
            const lastSite: Site[] = [];
            player.site.forEach(site => {
                const { minusDiceCard = 0, isLast = false } = newSite(site.id).handle(site, {
                    card: c,
                    dices: player.dice,
                    hcards: player.handCards,
                    heros: player.heros,
                    hidxs: [player.hidx],
                    playerInfo: player.playerInfo,
                    minusDiceCard: costChange[ci],
                });
                if (isLast) lastSite.push(site);
                else costChange[ci] += minusDiceCard;
            });
            lastSite.forEach(site => {
                costChange[ci] += newSite(site.id).handle(site, {
                    card: c,
                    dices: player.dice,
                    hcards: player.handCards,
                    heros: player.heros,
                    hidxs: [player.hidx],
                    playerInfo: player.playerInfo,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
            player.summon.forEach(smn => {
                costChange[ci] += newSummonee(smn.id).handle(smn, {
                    heros: player.heros,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
        });
        this.handCards.forEach((c, i) => c.costChange = costChange[i]);
    }
    /**
     * 计算切换角色所需骰子
     * @param tohidx 切换后的角色索引
     * @param fromhidx 切换前的角色索引
     * @param isOnlyAddTalent 是否只计算加的骰子和天赋的减骰子
     */
    _calcHeroChangeDice(tohidx: number, fromhidx: number, isOnlyAdd = false) {
        let minusDiceHero = 0;
        let addDiceHero = 0;
        const { minusDiceHero: stsmh1, addDiceHero: stsah1 } = this._doStatus(this.playerIdx, 4, 'change-from', { isExec: false, hidxs: [fromhidx], isOnlyInStatus: true });
        const { minusDiceHero: stsmh2, addDiceHero: stsah2 } = this._doStatus(this.playerIdx, 4, 'change-from', { isExec: false, isOnlyOutStatus: true });
        addDiceHero += this._doSummon(this.playerIdx ^ 1, 'change-oppo', { isUnshift: true, isExec: false }).addDiceHero;
        addDiceHero += stsah1 + stsah2;
        if (isOnlyAdd) return 1 + addDiceHero;
        minusDiceHero += stsmh1 + stsmh2;
        minusDiceHero += this._doSlot('change-to', { isExec: false, hidxs: tohidx }).minusDiceHero;
        minusDiceHero += this._doSlot('change', { isExec: false }).minusDiceHero;
        minusDiceHero += this._doSite(this.playerIdx, 'change', { isExec: false }).minusDiceHero;
        return this.heroChangeDice = Math.max(0, 1 - minusDiceHero + addDiceHero);
    }
    /**
     * 执行summon,site
     */
    _execTask(isWait = false) {
        if (this.taskQueue.isExecuting || this.taskQueue.isTaskEmpty() || !this._hasNotDieChange()) return;
        this.taskQueue.setIsExecuting(true);
        return new Promise<void>(async resolve => {
            let isDieChangeBack = false;
            while (this._hasNotDieChange() && !this.taskQueue.isTaskEmpty() && this.taskQueue.isExecuting) {
                await this._wait(() => this.actionInfo == '', 10, 100);
                const [taskType, args] = this.taskQueue.getTask();
                if (taskType == undefined || args == undefined) break;
                let task: [(() => void)[], number[]] | undefined;
                if (isDieChangeBack && taskType != 'addAtk') await this._delay(2300);
                if (taskType.startsWith('status')) task = this._doStatus(...(args as [any, any, any, any])).task;
                else if (taskType.startsWith('site')) task = this._doSite(...(args as [any, any, any])).task;
                else if (taskType.startsWith('summon')) task = this._doSummon(...(args as [any, any, any])).task;
                else if (taskType.startsWith('slot')) task = this._doSlot(...(args as [any, any])).task;
                if (taskType.startsWith('addAtk')) {
                    const isExeced = await this._doAddAtk(args as StatusTask, isDieChangeBack);
                    if (!isExeced) {
                        this.taskQueue.addStatusId([args as StatusTask], true);
                        break;
                    }
                } else await this.taskQueue.execTask(...(task ?? [[], []]));
                if (isDieChangeBack) isDieChangeBack = false;
                if (isWait) {
                    if (!this._hasNotDieChange()) isDieChangeBack = true;
                    await this._wait(() => this._hasNotDieChange(), 10, 500, 100000);
                }
            }
            this.taskQueue.setIsExecuting(false);
            resolve();
        });
    }
    /**
     * 是否触发
     * @param triggers 触发组
     * @param trigger 触发值
     * @returns 是否触发
     */
    _hasNotTrigger(triggers: Trigger[] | undefined, trigger: Trigger) {
        return (triggers ?? []).every(tr => tr != trigger.split(':')[0]);
    }
    /**
     * 延迟函数
     * @param callback 回调函数
     * @param time 延迟时间
     */
    _delay(time = 0) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, time);
        });
    }
    /**
     * 同步等待
     * @param cdt 跳出等待的条件
     * @param delay 跳出等待后的延迟
     * @param freq 判断的频率
     * @param recnt 判断的次数
     * @param f 判断的频率
     */
    async _wait(cdt: () => boolean, delay = 2000, freq = 500, recnt = 50) {
        let loop = 0;
        if (cdt()) return;
        while (true) {
            ++loop;
            await this._delay(freq);
            if (cdt()) {
                await this._delay(delay);
                break;
            }
            if (loop > recnt) throw new Error('too many loops');
        }
    }
}

class TaskQueue {
    socket: Socket;
    queue: [string, any[] | StatusTask][] = [];
    statusAtk: number = 0;
    isExecuting: boolean = false;
    isEndAtk: boolean = false;
    constructor(socket: Socket) {
        this.socket = socket;
    }
    addTask(taskType: string, args: any[], isUnshift = false) {
        if (isUnshift) this.queue.unshift([taskType, args]);
        else this.queue.push([taskType, args]);
        this._emit((isUnshift ? 'unshift' : 'add') + 'Task-' + taskType + `(queue=[${this.queue.map(v => v[0])}])`);
    }
    execTask(funcs: (() => void)[], intvl: number[]) {
        return new Promise<void>(async resolve => {
            for (let i = 0; i < funcs.length; ++i) {
                const isEndAtk = this.isTaskEmpty();
                await this._delay(funcs[i], intvl[i], isEndAtk);
                this.isExecuting = true;
                this.isEndAtk = isEndAtk;
                this._emit('execTask-step' + i);
            }
            resolve();
        });
    }
    getTask() {
        const res = this.queue.shift() ?? ['', [], -1];
        if ('id' in res[1]) --this.statusAtk;
        this._emit(`getTask:${res[0]}(queue=[${this.queue.map(v => v[0])}])`);
        return res;
    }
    isTaskEmpty() {
        return this.queue.length == 0;
    }
    addStatusId(ststask: StatusTask[], isUnshift = false) {
        if (ststask.length == 0) return;
        ststask.forEach(t => {
            if (isUnshift) this.queue.unshift(['addAtk', t]);
            else this.queue.push(['addAtk', t]);
        });
        this.statusAtk += ststask.length;
        this._emit(`${isUnshift ? 'unshift' : 'add'}StatusId(queue=[${this.queue.map(v => v[0])}])`);
    }
    hasStatusAtk() {
        return this.statusAtk > 0;
    }
    setIsEndAtk(val: boolean) {
        if (this.isEndAtk == val) return;
        this.isEndAtk = val;
        this._emit('setIsEndAtk');
    }
    setIsExecuting(val: boolean) {
        if (this.isExecuting == val) return;
        this.isExecuting = val;
        this._emit('setIsExecuting:' + val);
    }
    _emit(flag: string) {
        this.socket.emit('sendToServer', {
            taskVal: {
                queue: this.queue,
                isEndAtk: this.isEndAtk,
                isExecuting: this.isExecuting,
                statusAtk: this.statusAtk,
            },
            flag,
        });
    }
    _delay(callback?: (cbarg?: any) => any | null, time = 0, arg?: any) {
        return new Promise<void>(resolve => {
            setTimeout(() => {
                if (callback) callback(arg);
                resolve();
            }, time);
        });
    }
}

const PHASE = {
    NOT_READY: 0,
    NOT_BEGIN: 1,
    CHANGE_CARD: 2,
    CHOOSE_HERO: 3,
    DICE: 4,
    ACTION_START: 5,
    ACTION: 6,
    ACTION_END: 7,
    PHASE_END: 8,
    DIE_CHANGE: 9,
    DIE_CHANGE_END: 10,
}