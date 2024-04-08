import type { Socket } from "socket.io-client";

import { herosTotal, readySkill } from '@/data/heros';
import { cardsTotal } from '@/data/cards';
import { heroStatus } from '@/data/heroStatus';
import { newSummonee } from '@/data/summonee';
import { newSite } from "@/data/site";
import { ELEMENT, ELEMENT_ICON } from "@/data/constant";
import { allHidxs, clone, getAtkHidx, getBackHidxs, getNearestHidx, isCdt, parseShareCode } from "@/data/utils";

export default class GeniusInvokationClient {
    socket: Socket;
    userid: number; // 用户id
    players: Player[]; // 所有玩家信息数组
    isLookon: number; // 是否为观战玩家
    isValid: boolean = false; // 牌型是否合法
    isStart: boolean = false; // 是否开始游戏
    isDeckEdit: boolean = false; // 是否进入编辑卡组界面
    phase: number = PHASE.NOT_BEGIN; // 阶段
    handCards: Card[] = []; // 手牌
    skills: Skill[] = []; // 技能栏
    showRerollBtn: boolean = true; // 是否显示重投按钮
    rollCnt: number = -1; // 可重投的次数
    isReconcile: boolean = false; // 是否进入调和模式
    willAttachs: number[][] = new Array(6).fill([]); // 将要附着的元素
    willDamages: number[][] = new Array(6).fill([-1, 0]); // 将要受到的伤害
    dmgElements: number[] = new Array(3).fill(0); // 造成伤害元素
    willHeals: number[] = new Array(6).fill(-1); // 回血量
    willHp: (number | undefined)[] = new Array(6).fill(undefined); // 总共的血量变化
    elTips: [string, number, number][] = new Array(6).fill(['', 0, 0]); // 元素反应提示
    isShowDmg: boolean = false; // 是否显示伤害数
    isShowHeal: boolean = false; // 是否显示加血数
    isShowChangeHero: number = 0; // 是否显示切换角色按钮 0不显示 1显示 2显示且为快速行动
    isFall: boolean = false; // 是否为下落攻击状态
    canAction: boolean = false; // 是否可以操作
    willSummons: Summonee[][] = [[], []]; // 将要召唤的召唤物
    willSwitch: boolean[] = []; // 是否将要切换角色
    siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]]; // 支援物变化数
    summonCnt = [[0, 0, 0, 0], [0, 0, 0, 0]]; // 召唤物变化数
    canSelectHero: number = 0; // 可以选择角色的数量
    heroChangeDice: number = 1; // 切换角色消耗的骰子数
    isSwitchAtking = false; // 是否有切换后的攻击
    isReseted = true; // 是否已重置
    taskQueue: TaskQueue;
    round: number = 1; // 回合数
    isWin: number = -1; // 胜者idx
    playerIdx: number = -1; // 该玩家序号
    modalInfo: InfoVO = { ...NULL_MODAL }; // 展示信息
    tip: TipVO = { content: '' }; // 提示信息
    actionInfo: string = ''; // 行动信息
    currCard: Card = { ...NULL_CARD }; // 当前选择的卡
    currSkill: Skill = { ...NULL_SKILL }; // 当前选择的技能
    currHero: Hero | {} = {}; // 当前选择的角色
    exchangeSite: [Site, number][] = []; // 要交换的支援物
    decks: { name: string, shareCode: string }[] = [];
    deckIdx: number; // 出战卡组id
    editDeckIdx: number; // 当前编辑卡组idx
    countdown: Countdown = { curr: 0, limit: 0, timer: null }; // 倒计时配置
    log: string[] = []; // 当局游戏日志
    isMobile: boolean; // 是否为手机
    error: string = ''; // 服务器发生的错误信息
    constructor(
        socket: Socket, userid: number, players: Player[], isMobile: boolean, timelimit: number,
        decks: { name: string, shareCode: string }[], deckIdx: number, isLookon: number
    ) {
        this.socket = socket;
        this.userid = userid;
        this.players = players;
        this.isLookon = isLookon;
        this.playerIdx = isLookon > -1 ? isLookon : players.findIndex(p => p.id == this.userid);
        this.deckIdx = deckIdx;
        this.editDeckIdx = deckIdx;
        this.decks = decks;
        this.taskQueue = new TaskQueue(socket);
        this.isMobile = isMobile;
        this.countdown.limit = timelimit;
    }
    get player() { // 本玩家
        return this.players[this.playerIdx] ?? { ...NULL_PLAYER };
    }
    get opponent() { // 敌方玩家
        return this.players[this.playerIdx ^ 1] ?? { ...NULL_PLAYER };
    }
    /**
     * 取消选择
     */
    cancel(options: { onlyCard?: boolean, notCard?: boolean, notHeros?: boolean, onlyHeros?: boolean, onlySiteAndSummon?: boolean } = {}) {
        const { onlyCard = false, notCard = false, notHeros = false, onlyHeros = false, onlySiteAndSummon = false } = options;
        this.willHp = new Array(6).fill(undefined);
        if (!onlyCard) {
            if ((!notHeros || onlyHeros) && !onlySiteAndSummon) {
                this.player?.heros.forEach(h => {
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
                this.player.site.forEach(site => {
                    site.canSelect = false;
                    site.isSelected = false;
                });
                if (onlySiteAndSummon) return;
            }
        }
        if (this.currCard.canSelectSite > -1 && this.modalInfo.type > -1) {
            this.modalInfo = { ...NULL_MODAL }
            return;
        }
        const sidx = this.handCards.findIndex(c => c.selected);
        if (!notCard) this.handCards.forEach(card => card.selected = false);
        if (this.isMobile && sidx > -1) {
            this.mouseleave(sidx, true);
        }
        if (onlyCard) return;
        this.modalInfo = { ...NULL_MODAL }
        this.currCard = { ...NULL_CARD };
        this.currSkill = { ...NULL_SKILL };
        this.willSummons = [[], []];
        this.willSwitch = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(false);
        this.willAttachs = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(0).map(() => []);
        this.siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        this.summonCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        this.isValid = false;
        this.isShowChangeHero = 0;
        this.isReconcile = false;
        this.player.diceSelect = this.player.dice.map(() => false);
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
    selectCard(idx: number) {
        if (this.phase < 2 || this.taskQueue.isExecuting) return;
        if (this.player.status == 1) this.reconcile(false);
        this.currSkill = { ...NULL_SKILL };
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
                    this.cancel();
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
        if (this.player.phase < PHASE.ACTION || this.isLookon > -1) return;
        this.player.heros.forEach(h => h.isSelected = 0);
        [...this.player.summon, ...this.opponent.summon].forEach(smn => smn.isSelected = false);
        if (this.player.status == 1) {
            const { isValid, diceSelect } = this.checkCard();
            const { canSelectHero, canSelectSummon, canSelectSite } = this.currCard;
            this.isValid = isValid && canSelectHero == 0 && canSelectSummon == -1 && canSelectSite == -1;
            if ([2, 3, 4].some(sbtp => this.currCard.subType.includes(sbtp))) {
                const isAvalible = this.player.site.length < 4;
                this.isValid = this.isValid && isAvalible;
                if (!isAvalible) this.player.site.forEach(s => s.canSelect = true);
            }
            this.player.diceSelect = [...diceSelect];
            if (isValid && !this.isValid) {
                this.isValid = true;
                if (canSelectHero == 1 && this.player.heros.filter(h => h.canSelect).length == 1) {
                    this.player.heros.forEach(h => h.isSelected = +h.canSelect);
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
    checkCard() {
        let { cost, costType, canSelectHero, type, userType, id, canSelectSite,
            subType, anydice, costChange, canSelectSummon, energy } = this.currCard;
        const { dice, heros, hidx, summon, isUsedSubType8 } = this.player;
        cost = Math.max(0, cost - costChange);
        let isValid: boolean = false;
        let diceSelect: boolean[] = [];
        const diceLen = dice.length;
        this.siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        const cardres = cardsTotal(id)?.handle(this.currCard, {
            heros,
            hidxs: [hidx],
            ephase: this.opponent.phase,
            round: this.round,
            dicesCnt: dice.length,
            hcardsCnt: this.handCards.length,
            ehcardsCnt: this.opponent.handCards.length,
            esite: this.opponent.site,
            esummons: this.opponent.summon,
        });
        if (cardres.hidxs?.length == 0 ||
            cardres.summon && summon.length == 4 ||
            cardres.isValid == false ||
            subType.includes(8) && isUsedSubType8 ||
            heros[hidx].energy < energy
        ) {
            return { isValid: false, diceSelect: new Array(diceLen).fill(false) };
        }
        heros.forEach((hero, i) => {
            const canSelectHeros = cardres.canSelectHero?.[i] ?? (hero.hp > 0);
            hero.canSelect = canSelectHero > 0 && canSelectHeros && (
                type == 1 || type == 2 && subType.length == 0 ||
                subType.includes(0) && userType == hero.weaponType ||
                subType.includes(1) ||
                subType.includes(5) && !hero.inStatus.some(ist => ist.id == 2009) ||
                subType.includes(6) && userType == hero.id && (hero.isFront || !subType.includes(7)) ||
                subType.some(sbtp => [7, 8, 9].includes(sbtp)) && userType == 0
            );
        });
        if (userType == 0 && canSelectHero == heros.filter(h => h.isSelected).length ||
            userType == this._getFrontHero().id && canSelectHero == heros.filter(h => h.canSelect).length
        ) {
            const { willHeals } = this._doCmds([...(cardres.cmds ?? [])], {
                isCard: true,
                hidxs: isCdt(heros.some(h => h.isSelected), [heros.findIndex(h => h.isSelected)]),
                isExec: false
            });
            this._doHeal(willHeals, heros, { isExec: false });
        }
        this.players.forEach(p => {
            p.summon.forEach(smn => {
                smn.canSelect = canSelectSummon > -1 && (p.pidx ^ canSelectSummon) != this.playerIdx;
                if (canSelectSummon == -1) smn.isSelected = false;
            });
            p.site.forEach(st => {
                if (type != 1 || p.site.length < 4) st.canSelect = canSelectSite > -1 && (p.pidx ^ canSelectSite) != this.playerIdx;
                if (canSelectSite == -1 && p.site.length < 4) st.isSelected = false;
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
    useCard() {
        if (!this.isValid) return;
        const { player, opponent } = this;
        const hidxs = player.heros.map((h, i) => ({ hidx: i, val: h.isSelected }))
            .filter(v => v.val > 0).sort((a, b) => a.val - b.val).map(v => v.hidx);
        const handCards = this.handCards.filter(c => !c.selected);
        const currCard = { ...this.currCard, selected: false };
        if (currCard.type == 1 && player.site.length == 4) {
            ++this.player.playerInfo.destroyedSite;
        }
        const oSiteCnt = player.site.length;
        const cardres = cardsTotal(currCard.id).handle(currCard, {
            hidxs,
            heros: player.heros,
            eheros: opponent.heros,
            summons: player.summon,
            esummons: opponent.summon,
            hcardsCnt: player.handCards.length,
            ehcardsCnt: opponent.handCards.length,
            round: this.round,
            playerInfo: player.playerInfo,
            site: player.site,
            esite: opponent.site,
        });
        player.playerInfo.destroyedSite += oSiteCnt - player.site.length;
        player.heros.forEach(h => {
            h.isSelected = 0;
            h.canSelect = false;
        });
        if (currCard.type != 0) cardres.exec?.();
        let { minusDiceCard } = this._doSlot('card', { hidxs: allHidxs(player.heros, { isAll: true }), hcard: currCard });
        const { isInvalid, minusDiceCard: stsmdc } = this._doStatus(this.playerIdx, [1, 4], 'card', { card: currCard, isOnlyFront: true, minusDiceCard });
        if (isInvalid) {
            this.socket.emit('sendToServer', {
                handCards,
                currCard,
                heros: player.heros,
                flag: `useCard-${currCard.name}-invalid-${this.playerIdx}`,
            });
        } else {
            let isAction = currCard.subType.includes(7);
            const cardcmds = [...(cardres.cmds ?? [])];
            const { cmds: otherCmds } = this._doSite(this.playerIdx, 'card', { hcard: currCard, minusDiceCard: stsmdc, isQuickAction: !isAction });
            cardcmds.push(...otherCmds);
            let aHeros: Hero[] = clone(player.heros);
            let aSummon: Summonee[] = this._updateSummon([], player.summon, this._getFrontHero().outStatus);
            let esummon: Summonee[] = this._updateSummon([], opponent.summon, this._getFrontHero(-1).outStatus);
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
            const { ndices, phase = player.phase, heros, willHeals, isSwitch = -1 } = this._doCmds(cardcmds, { isCard: true, hidxs: isCdt(hidxs.length > 0, hidxs) });
            this._doHeal(willHeals, aHeros, { isQuickAction: !currCard.subType.includes(7) });
            if (heros) aHeros = [...heros];
            if (cardcmds.length > 0) {
                for (let i = 0; i < cardcmds.length; ++i) {
                    const { cmd = '', element = 0, hidxs: chidxs } = cardcmds[i];
                    // if (!chidxs) cardcmds[i].hidxs = [...hidxs];
                    if (cmd == 'attach') {
                        (chidxs ?? []).forEach((hidx, hi) => {
                            const { esummon: asummon1, eheros: eheros1, asummon: esummon1, elTips: elTips1 }
                                = this._elementReaction(
                                    typeof element == 'number' ? element == -1 ? aHeros[player.hidx].element : element : element[hi],
                                    [],
                                    hidx,
                                    aHeros, aSummon,
                                    opponent.heros, esummon,
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
            if (cardres.hidxs && currCard.type > 0) hidxs.splice(0, 20, ...cardres.hidxs);
            const site: Site[] = [...player.site];
            let isSiteDestroy = false;
            if (cardres.site) {
                if (site.length == 4) {
                    const selectSiteIdx = site.findIndex(site => site.isSelected);
                    site.splice(selectSiteIdx, 1);
                    isSiteDestroy = true;
                }
                site.push(...cardres.site);
            }
            if (oSiteCnt - player.site.length > 0) isSiteDestroy = true;
            if (isSiteDestroy) this._doSite(this.playerIdx, 'site-destroy', { csite: site, isQuickAction: true });
            aSummon = this._updateSummon(cardres.summon ?? [], aSummon, aHeros[player.hidx].outStatus);
            esummon = this._updateSummon([], esummon, opponent.heros[opponent.hidx].outStatus);
            player.heros = [...aHeros];
            const cardrescmds: Cmds[] = [
                { cmd: 'getOutStatus', status: cardres.outStatus },
                { cmd: 'getInStatus', status: cardres.inStatus, hidxs: cardres.hidxs ?? hidxs },
                { cmd: 'getOutStatusOppo', status: cardres.outStatusOppo },
                { cmd: 'getInStatusOppo', status: cardres.inStatusOppo, hidxs: cardres.hidxs ?? hidxs },
            ];
            this._doCmds(cardrescmds, { isEffectHero: true });
            if (isAction) this.player.canAction = false;
            isAction &&= isUseSkill;
            if (isSwitch > -1) {
                this._doStatus(this.playerIdx, 1, 'change-from', { isQuickAction: isCdt(!isAction, 2), isSwitchAtk: isUseSkill });
            }
            currCard.selected = false;
            currCard.costChange = 0;
            this.cancel();
            this.socket.emit('sendToServer', {
                handCards,
                currCard,
                dices: isCdt(!isAction, ndices),
                hidxs,
                heros: isCdt(!isAction, player.heros),
                eheros: isCdt(!isAction, opponent.heros),
                cardres,
                site,
                summonee: isCdt(!isAction, aSummon),
                esummon,
                elTips,
                phase,
                playerInfo: this.player.playerInfo,
                flag: `useCard-${currCard.name}-${this.playerIdx}`,
            });
        }
        this.cancel();
    }
    /**
     * 鼠标进入卡
     * @param idx 进入的卡的索引idx
     * @param force 是否强制执行该函数
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
        console.info(`player[${this.player.name}]:${this.isStart ? 'cancelReady' : 'startGame'}-${this.playerIdx}`);
        this.isStart = !this.isStart;
        this.isWin = -1;
        this.socket.emit('sendToServer', {
            phase: this.player.phase ^ 1,
            cpidx: this.playerIdx,
            did: this.deckIdx,
            heros: deck.heroIds.map(herosTotal),
            cards: deck.cardIds.map(cardsTotal),
            flag: 'startGame-' + this.playerIdx,
        });
    }
    /**
     * 投降
     */
    giveup() {
        this.socket.emit('sendToServer', { cpidx: this.playerIdx, giveup: true });
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
                        }, new Array<number>(8).fill(0)))) < cskill.cost[0].val - cskill.costChange[0];
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
        if (player.pidx == this.playerIdx && this._getFrontHero()?.id == frontHero?.id) this.skills = skills;
    }
    /**
     * 获取玩家信息
     * @param data 一些数据
     */
    roomInfoUpdate(data: any) {
        this.players = [...(data?.players ?? this.players)];
        this.isStart = data.isStart ?? this.isStart;
        this.phase = data.phase ?? this.phase;
        this.canAction = this.player?.canAction ?? false;
        this._startTimer(data.currCountdown);
        if (data.taskQueueVal) {
            this.taskQueue.queue = data.taskQueueVal.queue;
            this.taskQueue.isEndAtk = data.taskQueueVal.isEndAtk;
            this.taskQueue.isExecuting = data.taskQueueVal.isExecuting;
            this.taskQueue.statusAtk = data.taskQueueVal.statusAtk;
        }
        if (data.isFlag) this.socket.emit('sendToServer');
        this.wrap(this.player);
        this._clacCardChange();
    }
    /**
     * 从服务器获取数据
     * @param data players: 玩家信息, winnerIdx: 胜者索引idx, phase: 游戏阶段, log: 日志
     */
    async getServerInfo(data: any) {
        const { players, winnerIdx, phase, round, log, isSendActionInfo, dmgElements,
            willDamage, willHeals, startIdx, isUseSkill, dieChangeBack, isChangeHero,
            changeTo, resetOnly, elTips, changeFrom, taskQueueVal, execIdx, cidx,
            actionStart, heroDie, chooseInitHero, isSwitchAtking,
            actionAfter, startTimer, flag, error } = data;
        // console.info('server-flag:', flag);
        if (this.isLookon > -1 && this.isLookon != this.playerIdx) {
            this.players = players;
            return;
        }
        if (flag == 'game-end') {
            this.isStart = false;
            this.phase = phase ?? PHASE.NOT_READY;
            if (players) this.players = [...players];
            if (error) this.error = error;
            else this.isWin += 2;
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
            if (this.player?.phase == PHASE.CHANGE_CARD &&
                players[this.playerIdx]?.phase == PHASE.CHOOSE_HERO) {
                await this._sendTip('选择出战角色');
            }
            const isMyTurn = () => players[this.playerIdx].heros[this.player.hidx].inStatus.every((ist: Status) => !ist.type.includes(14));
            if (this.player.status == 0 && players[this.playerIdx].status == 1 && phase == PHASE.ACTION) {
                await this._sendTip('你的回合开始');
                if (isMyTurn()) {
                    setTimeout(() => {
                        this._doStatus(this.playerIdx, 11, 'useReadySkill', { isOnlyFront: true, isOnlyInStatus: true });
                    }, 200);
                }
                this.cancel();
            }
            if (this.opponent?.status == 0 && players[this.playerIdx ^ 1].status == 1 && phase == PHASE.ACTION) {
                await this._sendTip('对方回合开始');
            }
            if (players[this.playerIdx]?.phase == PHASE.ACTION && players[this.playerIdx ^ 1]?.phase == PHASE.ACTION_END &&
                (isUseSkill || isChangeHero) && !this.isSwitchAtking && dieChangeBack == undefined) {
                setTimeout(async () => {
                    await this._wait(() => !this.taskQueue.isExecuting && this.taskQueue.isTaskEmpty(), { delay: 0 });
                    await this._sendTip('继续你的回合')
                    if (isMyTurn()) {
                        setTimeout(() => {
                            this._doStatus(this.playerIdx, 11, 'useReadySkill', { isOnlyFront: true, isOnlyInStatus: true });
                        }, 2500);
                    }
                }, 2000);
                this.cancel();
            }
            if (players[this.playerIdx ^ 1]?.phase == PHASE.ACTION && players[this.playerIdx]?.phase == PHASE.ACTION_END &&
                (isUseSkill || isChangeHero) && !this.isSwitchAtking && dieChangeBack == undefined) {
                setTimeout(async () => {
                    await this._wait(() => !this.taskQueue.isExecuting && this.taskQueue.isTaskEmpty(), { delay: 0 });
                    await this._sendTip('对方继续回合');
                }, 2000);
            }
            if ([PHASE.ACTION, PHASE.ACTION_END].includes(this.player?.phase) &&
                [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(players[this.playerIdx].phase)) { // 我方出战角色阵亡
                await this._sendTip('选择出战角色');
            }
            if ([PHASE.ACTION, PHASE.ACTION_END].includes(this.opponent.phase) &&
                [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(players[this.playerIdx ^ 1].phase)) { // 对方出战角色阵亡
                this.canAction = false;
                await this._sendTip('等待对方选择出战角色');
            }
        }
        if (this.playerIdx == execIdx && dieChangeBack == undefined) {
            // if (dieChangeBack == undefined) {
            this._execTask();
        }
        const siteDiffCnt = this.player.site.length - players[this.playerIdx].site.length - this.exchangeSite.length;
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
            // if (flag != 'endPhase-hasStatusAtk') this.players = [...players];
            // else this.players.forEach(p => p.status = p.status ^ 1);
            this.players = [...players];
        }
        if (round > 1 || this.player?.phase != PHASE.CHOOSE_HERO || changeTo == this.playerIdx) {
            if (this.players.some(p => p.heros.some(h => {
                return h.inStatus.some(ist => (ist.useCnt == 0 || ist.roundCnt == 0) && ist.type.every(t => ![1, 9, 15].includes(t))) ||
                    h.outStatus.some(ost => (ost.useCnt == 0 || ost.roundCnt == 0) && ost.type.every(t => ![1, 9, 15].includes(t)))
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
                    heros: this.player.heros,
                    eheros: this.opponent.heros,
                    updateToServerOnly: true,
                    flag: 'getServerInfo-updateToServerOnly-' + this.playerIdx,
                });
            }
        }
        if (resetOnly) {
            this.isReseted = true;
            return;
        }
        const hasReadySkill = this._getFrontHero()?.inStatus.some(ist => ist.type.includes(11)) &&
            this._getFrontHero()?.inStatus.every(ist => !ist.type.includes(14));

        this.canAction = !hasReadySkill && !!this.player?.canAction && players[this.playerIdx].phase == PHASE.ACTION &&
            this.taskQueue.isTaskEmpty() && this.isStart;

        this.round = round;
        if ([PHASE.CHANGE_CARD, PHASE.ACTION_END, PHASE.PHASE_END].includes(this.phase) && phase == PHASE.DICE && changeTo == undefined) {
            this.phase = phase;
            this.rollCnt = 1;
            this.cancel();
            await this._sendTip('骰子投掷阶段');
            this.showRerollBtn = true;
            const dices = this.rollDice();
            if (dices) this.socket.emit('sendToServer', { cpidx: this.playerIdx, dices, flag: 'getServerInfo-phase-dice-' + this.playerIdx });
        }
        if (this.phase == PHASE.DICE && phase == PHASE.ACTION_START) { // 开始阶段
            this.showRerollBtn = true;
            this.isFall = false;
            await this._sendTip(`第${this.round}轮开始`);
            if (this.round == 1) this.phase = phase;
            setTimeout(async () => {
                this.isReseted = false;
                this.player.heros.forEach(h => { // 重置技能
                    for (let i = 0; i < h.skills.length; ++i) {
                        const skill = h.skills[i];
                        (skill.rdskidx == -1 ? herosTotal(h.id).skills[i] : readySkill(skill.rdskidx)).handle({ reset: true, hero: h, skidx: i });
                    }
                });
                this.player.site.forEach(site => { // 重置场地
                    newSite(site.id).handle(site, { reset: true });
                });
                const rOutStatus: Status[] = [];
                this.player.summon.forEach(smn => { // 重置召唤物
                    const { rOutStatus: rOst = [] } = newSummonee(smn.id).handle(smn, { reset: true });
                    rOutStatus.push(...rOst);
                })
                this.player.heros.forEach(h => {
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
                    for (let hi = 0; hi < this.player.heros.length; ++hi) {
                        this._doSkill5(hi, 'game-start');
                    }
                }
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    heros: this.player.heros,
                    site: this.player.site,
                    summonee: this.player.summon,
                    resetOnly: true,
                    flag: 'getServerInfo-phase-start-reset-' + this.playerIdx,
                });
                if (this.playerIdx == execIdx) {
                    await this._wait(() => this.isReseted, { delay: 0 });
                    this._doSlot('phase-start', { pidx: startIdx, hidxs: allHidxs(players[startIdx].heros, { isAll: true }) });
                    await this._execTask(true);
                    this._doStatus(startIdx, [1, 4], 'phase-start', { intvl: [100, 500, 1000, 100] });
                    await this._execTask(true);
                    this._doSummon(startIdx, 'phase-start');
                    await this._execTask(true);
                    const { exchangeSite: ecs1 } = this._doSite(startIdx, 'phase-start', { firstPlayer: startIdx });
                    this.exchangeSite.push(...ecs1);
                    for (const [exsite, pidx] of ecs1) {
                        this.players[pidx].site.push(exsite);
                    }
                    await this._execTask(true);
                    this._doSlot('phase-start', { pidx: startIdx ^ 1, hidxs: allHidxs(players[startIdx ^ 1].heros, { isAll: true }) });
                    await this._execTask(true);
                    this._doStatus(startIdx ^ 1, [1, 4], 'phase-start', { intvl: [100, 500, 1000, 100] });
                    await this._execTask(true);
                    this._doSummon(startIdx ^ 1, 'phase-start');
                    await this._execTask(true);
                    const { exchangeSite: ecs2 } = this._doSite(startIdx ^ 1, 'phase-start', { firstPlayer: startIdx });
                    this.exchangeSite.push(...ecs2);
                    for (const [exsite, pidx] of ecs2) {
                        this.players[pidx].site.push(exsite);
                    }
                    await this._execTask(true);
                    await this._delay(200);
                    for (const [exsite, pidx] of this.exchangeSite) {
                        this.players[pidx].site.push(exsite);
                    }
                    await this._wait(() => this.actionInfo == '', { delay: 500, freq: 100, isImmediate: false });
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
            // if (this.phase == PHASE.ACTION && phase == PHASE.ACTION_END) { // 结束阶段
            await this._sendTip('结束阶段');
            setTimeout(async () => {
                this._doSlot('phase-end', { pidx: startIdx, hidxs: allHidxs(players[startIdx].heros, { isAll: true }) });
                await this._execTask(true);
                this._doStatus(startIdx, [1, 3, 9], 'phase-end', { intvl: [100, 500, 1000, 100] });
                await this._execTask(true);
                this._doSummon(startIdx, 'phase-end');
                await this._execTask(true);
                this._doSite(startIdx, 'phase-end');
                await this._execTask(true);
                this._doSlot('phase-end', { pidx: startIdx ^ 1, hidxs: allHidxs(players[startIdx ^ 1].heros, { isAll: true }) });
                await this._execTask(true);
                this._doStatus(startIdx ^ 1, [1, 3, 9], 'phase-end', { intvl: [100, 500, 1000, 100] });
                await this._execTask(true);
                this._doSummon(startIdx ^ 1, 'phase-end');
                await this._execTask(true);
                this._doSite(startIdx ^ 1, 'phase-end');
                await this._execTask(true);
                this._wait(() => !this.taskQueue.isExecuting, { delay: 1100 });
                if (this.taskQueue.hasStatusAtk() || this.isSwitchAtking) {
                    this.isSwitchAtking = true;
                    await this._wait(() => !this.isSwitchAtking, { delay: 2300 });
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
                    await this._wait(() => this.actionInfo == '', { delay: 500, freq: 100, isImmediate: false })
                    this.socket.emit('sendToServer', {
                        roundPhase: PHASE.PHASE_END,
                        cpidx: this.playerIdx,
                        heros: this.player.heros,
                        eheros: this.opponent.heros,
                        flag: 'getServerInfo-phase-end-changePhase-' + execIdx,
                    });
                }
            }, 1500);
        }
        setTimeout(() => {
            this.phase = phase;
        }, phase == PHASE.DICE && this.round == 1 ? 1000 : 0);
        if (phase >= PHASE.CHANGE_CARD) this._calcSkillChange(1, players[this.playerIdx].hidx);
        this._clacCardChange();
        if (changeTo == this.playerIdx) { // 切换了角色
            this.isFall = true;
            const { hidx } = this.player;
            this._doSkill5(hidx, 'change-to');
            this._doStatus(this.playerIdx, 11, 'change-from', { hidxs: [changeFrom], isOnlyInStatus: true });
            const heros = this.player.heros;
            const { nheros: ncheros = [], nstatus } = this._updateStatus(heros[hidx].outStatus, [], heros, hidx);
            heros[hidx] = ncheros[hidx];
            heros[hidx].outStatus = [...nstatus];
            if (phase > PHASE.ACTION) {
                heros[hidx].inStatus.forEach(ist => {
                    if (ist.roundCnt > 0) ++ist.roundCnt;
                });
            }
            if (changeFrom != undefined) {
                const noheros = this._updateStatus([], ncheros[hidx].outStatus, ncheros, -1, changeFrom).nheros ?? [];
                heros[changeFrom] = noheros[changeFrom];
            }
            this.socket.emit('sendToServer', {
                cpidx: changeTo,
                heros,
                hidx,
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
            setTimeout(() => this.isShowHeal = false, 1800);
        }
        if (willDamage) { // 受伤
            this.willDamages = [...willDamage];
            if (isSendActionInfo) this.isShowDmg = true;
        }
        if (isSendActionInfo) this._sendActionInfo(isSendActionInfo);
        if (dieChangeBack == PHASE.ACTION) { // 对方选完出战角色
            setTimeout(() => this._sendTip(this.player.status == 1 ? '继续你的回合' : '对方继续回合'), 1000);
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
        if (actionAfter?.[0] == this.playerIdx) { // 我方执行任意行动后
            if (isUseSkill) await this._delay(2300);
            let isTriggered = false;
            this.player.heros.forEach((_, hi) => isTriggered ||= this._doSkill5(hi, 'action-after').isTriggered);
            this._doStatus(this.playerIdx, [1, 4], 'status-destroy', { intvl: [100, 500, 1000, 100], isOnlyFront: true, isQuickAction: actionAfter?.[1] == 1 });
            await this._execTask();
            this.player.heros.forEach(h => {
                h.inStatus = this._updateStatus([], h.inStatus).nstatus;
                if (h.isFront) h.outStatus = this._updateStatus([], h.outStatus).nstatus;
            });
            this._doSite(this.playerIdx, 'action-after', { isQuickAction: actionAfter?.[1] == 1 });
            await this._execTask();
            if (isTriggered) {
                this.socket.emit('sendToServer', {
                    cpidx: this.playerIdx,
                    heros: this.player.heros,
                    flag: 'actionAfter-' + this.playerIdx,
                });
            }
        }
        if (actionStart == this.playerIdx && ![PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase)) { // 我方选择行动前
            this._doStatus(this.playerIdx, [1, 4], 'action-start', { intvl: [100, 500, 1000, 100], isOnlyFront: true });
            await this._execTask();
            this._doSummon(this.playerIdx, 'action-start');
            await this._execTask();
            this._doSite(this.playerIdx, 'action-start');
            await this._execTask();
        }
        if (startTimer) this._startTimer();
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
        if (this.isLookon > -1) return;
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
                this.player.diceSelect[i] = true;
            }
            this.player.heros.forEach((h, hi) => {
                if (hi != this.player.hidx) {
                    if (hi == hidx) h.isSelected = 1;
                    else h.isSelected = 0;
                    h.canSelect = true;
                }
            });
            this.modalInfo = { ...NULL_MODAL };
            this.useSkill(-1, { isOnlyRead: true, otriggers: 'change-from' });
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
            this.currCard = { ...NULL_CARD };
            const sidx = this.handCards.findIndex(c => c.selected);
            this.handCards.forEach(v => v.selected = false);
            if (this.isMobile && sidx > -1) this.mouseleave(sidx, true);
            this.modalInfo = {
                isShow: true,
                type: 4,
                info: this.players[this.playerIdx ^ pidx ^ 1].heros[hidx],
            };
        }
        if (this.isLookon > -1) return;
        if (!this.currCard.subType.includes(7) || this.currCard.canSelectHero == 0) {
            this.currSkill = { ...NULL_SKILL };
        }
        this.willSummons = [[], []];
        this.willAttachs = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(0).map(() => []);
        if (this.player.phase == PHASE.CHOOSE_HERO && pidx == 1) { // 选择初始出战角色
            this.cancel({ onlyCard: true, notHeros: true });
            this.player.heros.forEach((h, idx) => {
                if (h.isSelected == 1 && idx == hidx) {
                    h.isFront = true;
                    h.isSelected = 0;
                    this.socket.emit('sendToServer', { cpidx: this.playerIdx, hidx, isChangeHero: true, flag: 'chooseInitHero-' + this.playerIdx });
                } else h.isSelected = +(idx == hidx);
            });
        } else {
            if (this.isShowChangeHero > 1 && pidx == 1 && this.player.heros[hidx].canSelect) {
                this.player.heros.forEach((h, hi) => {
                    if (hi == hidx) h.isSelected = 1;
                    else h.isSelected = 0;
                });
                this.player.diceSelect.forEach((_, i, a) => a[i] = false);
                this.chooseHero();
                this.modalInfo = { ...NULL_MODAL };
            } else {
                this.cancel({ onlyHeros: true });
                this.isShowChangeHero = +((this.player.status == 1 || [PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.player.phase)) &&
                    pidx == 1 && !this.player.heros[hidx].isFront && this.currCard.id <= 0 && this.player.heros[hidx].hp > 0);
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
    selectCardHero(pidx: number, hidx: number) {
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
                    if (canSelectHero == 1) h.isSelected = +(hi == hidx);
                    else if (h.isSelected != 1) h.isSelected = +(hi == hidx) * 2;
                });
            } else {
                selectHero.isSelected = selected + 1;
            }
        }
        const { isValid } = this.checkCard();
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
        const curPlayer = this.player;
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
        this.player.diceSelect = [...dices];
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
        if (this.player.dice.every(v => [0, this._getFrontHero().element].includes(v))) return;
        if (bool) {
            if (!this.isReconcile) {
                this.isReconcile = true;
                const { isValid, diceSelect } = this.checkCard();
                this.player.heros.forEach(h => {
                    h.canSelect = false;
                    h.isSelected = 0;
                });
                this.isValid = isValid;
                this.player.diceSelect = diceSelect;
            } else {
                const dices = this.player.dice.map((d, i) => {
                    const val = this.player.diceSelect[i] ? this._getFrontHero().element : d;
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
     * @param options isOnlyRead 是否为只读, isCard 是否为使用卡, isSwitch 是否切换角色, isReadySkill 是否为准备技能, triggers 触发数组(出牌或切换角色时)
     */
    async useSkill(sidx: number, options: { isOnlyRead?: boolean, isCard?: boolean, isSwitch?: number, isReadySkill?: boolean, otriggers?: Trigger | Trigger[] }) {
        if ([PHASE.DIE_CHANGE, PHASE.DIE_CHANGE_END].includes(this.opponent.phase)) return;
        const { isOnlyRead = false, isCard = false, isSwitch = -1, isReadySkill = false, otriggers = [] } = options;
        this.siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        const currSkill = { ...this.currSkill };
        const skill = isReadySkill ? this._calcSkillChange(1, this.player.hidx, { isReadySkill: sidx }) as Skill :
            (isSwitch > -1 ? (this._calcSkillChange(1, isSwitch, { isSwitch: true }) ?? []) as Skill[] : this.skills)[sidx];
        this.currSkill = { ...skill };
        if (sidx > -1 && (!this.currCard.subType.includes(7) || !isCard)) {
            this.currCard = { ...NULL_CARD };
            this.cancel({ onlyCard: true });
        }
        const curCard = { ...this.currCard };
        const curHandCards = clone(this.handCards);
        const isValid = this.isValid || isReadySkill;
        const isExec = !isOnlyRead && currSkill.name == skill?.name && isValid;
        const { heros: oaHeros, summon: oaSummon, hidx: ahidx, heros: { length: ahlen } } = this.player;
        let { heros: oeHeros, summon: oeSummon, hidx: eFrontIdx, heros: { length: ehlen } } = this.opponent;
        this.willSwitch = new Array(ahlen + ehlen).fill(false);
        const hidx = isSwitch > -1 ? isSwitch : ahidx;
        const curHandle = isReadySkill ? readySkill(sidx).handle : (skill?.rdskidx ?? -1) > -1 ?
            readySkill(skill.rdskidx).handle : herosTotal(oaHeros[hidx].id).skills.find(v => v.name === skill?.name)?.handle;
        let aHeros: Hero[] = clone(oaHeros);
        let aSummon: Summonee[] = clone(oaSummon);
        let eaHeros: Hero[] = clone(oeHeros);
        let esummon: Summonee[] = clone(oeSummon);
        const willDamagesPre: number[][] = new Array(aHeros.length + eaHeros.length).fill(0).map(() => [-1, 0]);
        const willAttachPre: number[][] = new Array(aHeros.length + eaHeros.length).fill(0).map(() => []);
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
                    const sts = clone([aHeros[ahidx].inStatus, aHeros[ahidx].outStatus][stsType].find(sts => sts.id == stsId));
                    if (sts == undefined) throw new Error('status not found');
                    const stsres = heroStatus(stsId).handle(sts, {
                        heros: aHeros,
                        eheros: eaHeros,
                        trigger: 'change-from',
                        hidx,
                    });
                    const stsreshidxs = stsres.hidxs ?? getBackHidxs(eaHeros);
                    const { willDamage: willDamage0, willAttachs: willAttachs0, eheros: eheros0,
                        esummon: esummon0, aheros: aheros0, asummon: asummon0, elrcmds: elrcmds0
                    } = this._elementReaction(
                        stsres.element ?? 0,
                        new Array(ehlen).fill(0).map((_, i) => [
                            i == eFrontIdx ? (stsres.damage ?? -1) : -1,
                            stsreshidxs.includes(i) ? (stsres.pendamage ?? 0) : 0
                        ]),
                        eFrontIdx,
                        eaHeros, esummon,
                        aHeros, aSummon,
                        { isExec, usedDice: skill.cost.reduce((a, b) => a + b.val, 0) }
                    );
                    willDamage0.forEach((dmg, di) => {
                        willDamagesPre[di] = allHeros[di].hp > 0 ? [...dmg] : [-1, 0];
                    });
                    for (let i = 0; i < ehlen; ++i) willAttachPre[i + (this.playerIdx ^ 1) * ahlen].push(willAttachs0[i]);
                    eaHeros = [...eheros0];
                    aHeros = [...aheros0];
                    aSummon = [...asummon0];
                    esummon = [...esummon0];
                    skillcmds.push(...elrcmds0[0]);
                    eskillcmds.push(...elrcmds0[1]);
                }
            }
            if (!isOnlyRead) {
                if (switchAtkPre > 0) this.isSwitchAtking = true;
                await this._delay(1100 + switchAtkPre * 3000);
                await this._wait(() => switchAtkPre == 0 || !this.isSwitchAtking);
                let { heros: oeHeros, summon: oeSummon } = this.opponent;
                const { heros: oaHeros, summon: oaSummon } = this.player;
                aHeros = clone(oaHeros);
                aSummon = clone(oaSummon);
                eaHeros = clone(oeHeros);
                esummon = clone(oeSummon);
            }
        }
        let aElTips: [string, number, number][] = [];
        let dmgElements: number[] = new Array(ehlen).fill(0);
        const aWillAttach: number[][] = clone(willAttachPre);
        const aWillDamages: number[][] = new Array(ahlen + ehlen).fill(0).map(() => [-1, 0]);
        const aWillHeal: number[] = new Array(ahlen + ehlen).fill(-1);
        const statusIds: StatusTask[] = [];
        const bWillAttach: number[][] = aWillAttach;
        const bWillDamages: number[][][] = [aWillDamages];
        const bWillHeal: number[][] = [aWillHeal];
        const isChargedAtk = skill?.type == 1 && ((this.player.dice.length + (!isOnlyRead && isCard ? (skill?.cost[0].val ?? 0) + (skill?.cost[1].val ?? 0) : 0)) & 1) == 0;
        const isFallAtk = skill?.type == 1 && (this.isFall || isSwitch > -1);
        if (curCard.id > 0) this._doSlot('card', { hidxs: allHidxs(aHeros, { isAll: true }), hcard: curCard, heros: aHeros });
        const skillres: SkillHandleRes = curHandle?.({
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
            trigger: `skilltype${skill.type}` as Trigger,
        }) ?? {};
        if (isExec) skillres.exec?.();
        if (skill) {
            if (skill.cost[2].val == 0) {
                aHeros[hidx].energy = Math.min(aHeros[hidx].maxEnergy + 1, aHeros[hidx].energy + 1);
            } else if (skill.cost[2].val > 0) {
                aHeros[hidx].energy = 0;
            }
        }
        const atriggers: Trigger[][] = new Array(ahlen).fill(0).map(() => []);
        const etriggers: Trigger[][] = new Array(ehlen).fill(0).map(() => []);
        if (sidx > -1) {
            this.isShowChangeHero = 0;
            let mds: number[][] = [];
            for (const curSkill of this._getFrontHero().skills) {
                if (curSkill.type == 4) continue;
                if (!curSkill) mds.push([0, 0]);
                else mds.push(curSkill.cost.slice(0, 2).map(v => v.val));
            }
            if (skillres.atkAfter || skillres.atkBefore) {
                const lhidx = allHidxs(this.opponent.heros);
                const offset = skillres.atkAfter ? 1 : skillres.atkBefore ? -1 : 0;
                eFrontIdx = lhidx[(lhidx.indexOf(eFrontIdx) + offset + lhidx.length) % lhidx.length];
            }
            if (skillres.atkTo != undefined) eFrontIdx = skillres.atkTo;
            const skillreshidxs = skillres.hidxs ?? getBackHidxs(eaHeros);
            const willDamages = new Array(aHeros.length + eaHeros.length).fill(0).map((_, di) => {
                if (di >= eaHeros.length) {
                    const ahi = di - eaHeros.length;
                    const penDmgOppo = (skillres.hidxs ?? [hidx]).includes(ahi) ? (skillres.pendamageSelf ?? 0) : 0;
                    return [-1, penDmgOppo]
                }
                const addDmg = skillres.addDmgCdt ?? 0;
                const elDmg = di == eFrontIdx && skill.damage + addDmg > 0 ? skill.damage + skill.dmgChange + addDmg : -1;
                const penDmg = skillreshidxs.includes(di) ? (skillres.pendamage ?? 0) : 0;
                return [elDmg, penDmg]
            });
            const stsprecmds: Cmds[] = [
                { cmd: 'getInStatus', status: skillres.inStatusPre, hidxs: skillres.hidxs },
                { cmd: 'getInStatusOppo', status: skillres.inStatusOppoPre, hidxs: skillres.hidxs },
                { cmd: 'getOutStatus', status: skillres.outStatusPre },
                { cmd: 'getOutStatusOppo', status: skillres.outStatusOppoPre },
            ];
            this._doCmds(stsprecmds, { heros: aHeros, eheros: eaHeros, ahidx: hidx, ehidx: eFrontIdx, isEffectHero: true });
            if (skillres.summonPre) aSummon = this._updateSummon(skillres.summonPre, aSummon, aHeros[isExec ? hidx : ahidx].outStatus);
            if (skillres.heal) {
                const healHidxs = skillres.hidxs ?? [hidx];
                this.player.heros.forEach((h, hi) => {
                    if (healHidxs.includes(hi)) {
                        const hidx = hi + (this.playerIdx ^ 1) * ehlen;
                        const hl = Math.min(h.maxhp - h.hp, skillres.heal ?? 0);
                        if (aWillHeal[hidx] < 0) aWillHeal[hidx] = hl;
                        else aWillHeal[hidx] += hl;
                    }
                });
            }
            const dmgEl = skillres.dmgElement ?? (skill.attachElement || skill.dmgElement);
            const { willDamage: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, siteCnt: siteCnt1,
                eheros: eheros1, esummon: esummon1, aheros: aheros1, asummon: asummon1, minusDiceSkill: mds1,
                elTips: elTips1, atriggers: atriggers1, etriggers: etriggers1, willheals: healres, elrcmds: elrcmds1,
            } = this._elementReaction(
                dmgEl,
                willDamages,
                eFrontIdx,
                eaHeros, esummon,
                aHeros, aSummon,
                {
                    isExec, skidx: sidx, sktype: skill.type, isChargedAtk, isFallAtk, isReadySkill,
                    usedDice: skill.cost.reduce((a, b) => a + b.val, 0), minusDiceSkill: mds, willheals: aWillHeal
                }
            );
            dmgElements = [...dmgElements1];
            eaHeros = [...eheros1];
            aHeros = [...aheros1];
            aElTips = [...elTips1];
            for (let i = 0; i < ehlen; ++i) aWillAttach[i + (this.playerIdx ^ 1) * ahlen].push(willAttachs1[i]);
            aSummon = [...asummon1];
            esummon = [...esummon1];
            atriggers1.forEach((at, ati) => atriggers[ati].push(...at));
            etriggers1.forEach((et, eti) => etriggers[eti].push(...et));
            if (mds1) mds = mds1;
            aWillHeal.forEach((_, awhi, awha) => awha[awhi] = healres[awhi]);
            this.siteCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += siteCnt1[sti][i]));
            skillcmds.push(...elrcmds1[0]);
            eskillcmds.push(...elrcmds1[1]);
            willDamage1.forEach((dmg, di) => {
                aWillDamages[di] = allHeros[di].hp > 0 ? [...dmg] : [-1, 0];
            });
            if (skillres.summon) aSummon = this._updateSummon(skillres.summon, aSummon, aHeros[hidx].outStatus);
            const stscmds: Cmds[] = [
                { cmd: 'getInStatus', status: skillres.inStatus, hidxs: skillres.hidxs },
                { cmd: 'getInStatusOppo', status: skillres.inStatusOppo, hidxs: skillres.hidxs },
                { cmd: 'getOutStatus', status: skillres.outStatus },
                { cmd: 'getOutStatusOppo', status: skillres.outStatusOppo },
            ];
            this._doCmds(stscmds, { heros: aHeros, eheros: eaHeros, ahidx: hidx, ehidx: eFrontIdx, isEffectHero: true });
            if (skillres.isAttach) {
                const { eheros: aheros2, esummon: asummon2, aheros: eheros2, elrcmds: elrcmds2, willAttachs: willAttachs2,
                    asummon: esummon2, elTips: elTips2, atriggers: etriggers2, etriggers: atriggers2,
                } = this._elementReaction(
                    skill.dmgElement,
                    [],
                    hidx,
                    aHeros, aSummon,
                    eaHeros, esummon,
                    { isAttach: true, isExec, elTips: elTips1 },
                );
                aHeros = [...aheros2];
                eaHeros = [...eheros2];
                aSummon = [...asummon2];
                esummon = [...esummon2];
                skillcmds.push(...elrcmds2[0]);
                eskillcmds.push(...elrcmds2[1]);
                aElTips = [...elTips2];
                const atkhidx = getAtkHidx(eaHeros);
                atriggers[hidx] = [...new Set([...atriggers[hidx], ...atriggers2[hidx]])];
                etriggers[atkhidx] = [...new Set([...etriggers[atkhidx], ...etriggers2[atkhidx]])];
                for (let i = 0; i < ahlen; ++i) aWillAttach[i + this.playerIdx * ehlen].push(willAttachs2[i]);
            }
            if (skillres.cmds) skillcmds.push(...skillres.cmds);

            const afterSkillTrgs = atriggers[hidx].filter(trg => trg.startsWith('skill')).map(v => 'after-' + v) as Trigger[];
            this._doSlot(afterSkillTrgs, { isExec, heros: aHeros });
            this._doStatus(this.playerIdx, 4, afterSkillTrgs, { isExec, isOnlyOutStatus: true, dmgElement: dmgEl, heros: aHeros });
        }

        const oeFrontIdx = this.opponent.hidx;
        let bHeros: Hero[][] = [clone(aHeros)];
        let ebHeros: Hero[][] = [clone(eaHeros)];
        let bSummon: Summonee[][] = [clone(aSummon)];
        let ebSummon: Summonee[][] = [clone(esummon)];
        if (isOnlyRead && switchAtkPre > 0) bWillDamages.unshift(clone(willDamagesPre));
        let isSwitchAtk = false;
        const isSwitchSelf = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && cmds.cmd?.includes('self'));
        const isSwitchOppo = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'));
        const calcAtk = (res: any, type: string, stsId: number, ahidx: number, ehidx: number, isOppo = false) => {
            if (res?.damage == undefined && res?.pendamage == undefined && res?.heal == undefined) return false;
            const nheros = clone(isOppo ? (ebHeros.at(-1) ?? []) : (bHeros.at(-1) ?? []));
            const neheros = clone(isOppo ? (bHeros.at(-1) ?? []) : (ebHeros.at(-1) ?? []));
            if (res?.damage == undefined && res?.pendamage == undefined) {
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
            if (ehidx == -1) ehidx = oeFrontIdx;
            const reshidxs = res?.hidxs ?? getBackHidxs(neheros);
            const willDamages = new Array(isOppo ? ahlen : ehlen).fill(0).map((_, i) => [
                i == (isOppo ? ahidx : ehidx) ? (res?.damage ?? -1) : -1,
                reshidxs.includes(i) ? (res?.pendamage ?? 0) : 0
            ]);
            const { willDamage: willDamage3, willAttachs: willAttachs3, eheros: eheros3, siteCnt: siteCnt3,
                esummon: esummon3, aheros: aheros3, asummon: asummon3, elrcmds: elrcmds3, etriggers: etriggers3, atriggers: atriggers3
            } = this._elementReaction(
                res.element,
                willDamages,
                isOppo ? ahidx : ehidx,
                isOppo ? (bHeros.at(-1) ?? []) : (ebHeros.at(-1) ?? []),
                isOppo ? (bSummon.at(-1) ?? []) : (ebSummon.at(-1) ?? []),
                isOppo ? (ebHeros.at(-1) ?? []) : (bHeros.at(-1) ?? []),
                isOppo ? (ebSummon.at(-1) ?? []) : (bSummon.at(-1) ?? []),
                { isExec: false, pidx: this.playerIdx ^ +isOppo }
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
            this.siteCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += siteCnt3[sti][i]));
            bHeros.push(isOppo ? eheros3 : aheros3);
            ebHeros.push(isOppo ? aheros3 : eheros3);
            bSummon.push([...(isOppo ? esummon3 : asummon3)]);
            ebSummon.push([...(isOppo ? asummon3 : esummon3)]);
            for (let i = 0; i < (isOppo ? ahlen : ehlen); ++i) bWillAttach[i + ((this.playerIdx ^ +!isOppo)) * (isOppo ? ehlen : ahlen)].push(willAttachs3[i]);
            bWillDamages.push(willDamage3);
            if (isOppo) {
                ahidx = cswo > -1 ? cswo : ahidx;
                ehidx = csw > -1 ? csw : ehidx;
            } else {
                ahidx = csw > -1 ? csw : ahidx;
                ehidx = cswo > -1 ? cswo : ehidx;
            }
            if (isOppo) {
                if (isSwitchOppo(elrcmds3[0])) atriggers3[hidx].push('change-from');
                const { statusIdsAndPidx } = this._doStatus(this.playerIdx, 1, atriggers3[hidx], { hidxs: [ahidx], isExec: false });
                if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
                doAfterStatus(aHeros[ahidx].inStatus, 0, atriggers3[ahidx], ahidx, ehidx, 0, true);
                doAfterStatus(aHeros[hidx].outStatus, 1, atriggers3[hidx], ahidx, ehidx, 0, true);
            } else {
                if (isSwitchOppo(elrcmds3[0])) etriggers3[hidx].push('change-from');
                const { statusIdsAndPidx } = this._doStatus(this.playerIdx ^ 1, 1, etriggers3[oeFrontIdx], { hidxs: [ehidx], isExec: false });
                if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
                doAfterStatus(eaHeros[ehidx].inStatus, 0, etriggers3[ehidx], ahidx, ehidx, 1, true);
                doAfterStatus(eaHeros[oeFrontIdx].outStatus, 1, etriggers3[oeFrontIdx], ahidx, ehidx, 1, true);
            }
            return false;
        }
        const doAfterStatus = (ostatus: Status[], stype: number, trgs: Trigger[], ahidx: number, ehidx: number, isOppo = 0, isAfterSwitch = false) => {
            const status = clone(ostatus);
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = oeFrontIdx;
            for (const sts of status) {
                for (const state of trgs) {
                    const stsres = heroStatus(sts.id).handle(sts, {
                        heros: isOppo ? eaHeros : aHeros,
                        eheros: isOppo ? aHeros : eaHeros,
                        hidx: isOppo ? ehidx : ahidx,
                        trigger: state,
                        isChargedAtk: isOppo ? false : isChargedAtk,
                    });
                    const isOppoAtk = +!!stsres.isOppo;
                    if (this._hasNotTrigger(stsres.trigger, state)) continue;
                    if (sts.type.includes(1) && (stsres.damage || stsres.pendamage || stsres.heal)) {
                        if (state.startsWith('after')) {
                            statusIds.push({ id: sts.id, type: stype, pidx: this.playerIdx ^ isOppo, isOppo: isOppoAtk, trigger: state, isAfterSwitch });
                        }
                        const dmg = new Array(ahlen + ehlen).fill(0).map((_, di) => bWillDamages.reduce((a, b) => a + b[di][0] + b[di][1], 0));
                        const willKill = isOppo ? dmg[(this.playerIdx ^ 1) * ehlen + ahidx] >= aHeros[ahidx].hp : dmg[this.playerIdx * ahlen + ehidx] >= eaHeros[ehidx].hp;
                        if (calcAtk(stsres, willKill ? 'die' : (['in', 'out'][stype] + 'Status'), sts.id, ahidx, ehidx, !!(isOppoAtk ^ isOppo))) continue;
                        if (stsres.heal) {
                            let willheals = new Array(ahlen + ehlen).fill(-1);
                            const whidx = sidx > -1 ? isOppo ? ehidx : ahidx : this.player.heros.findIndex(h => h.isSelected);
                            (isOppo ? eaHeros : aHeros).forEach((h, hi) => {
                                if ((stsres.hidxs ?? [whidx]).includes(hi)) {
                                    willheals[hi + (this.playerIdx ^ +!isOppo) * (isOppo ? ahlen : ehlen)] = Math.min(h.maxhp - h.hp, stsres.heal ?? -1);
                                }
                            });
                            bWillHeal.push(willheals);
                        }
                    }
                }
            }
        }
        const { ndices, heros: cmdh, isSwitch: swc = -1, isSwitchOppo: swco = -1 } = this._doCmds(skillcmds, { heros: aHeros, isExec });
        const { ndices: edices, heros: ecmdh } = this._doCmds(eskillcmds, { heros: eaHeros, pidx: this.playerIdx ^ 1, isExec });
        if (cmdh) aHeros = cmdh;
        if (ecmdh) eaHeros = ecmdh;
        const aswhidx = isSwitchSelf(skillcmds) ? swc : -1;
        const eswhidx = isSwitchOppo(skillcmds) ? swco : -1;
        if (sidx > -1) {
            const [afterASkillTrgs, afterESkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.map(trg => trg.startsWith('skill') ? 'after-' + trg : trg.startsWith('after-') ? trg.slice(6) : trg) as Trigger[]));
            eaHeros.forEach((h, hi) => {
                if (hi == oeFrontIdx) afterESkillTrgs[hi].push('status-destroy');
                doAfterStatus(h.inStatus, 0, afterESkillTrgs[hi], aswhidx, eswhidx, 1);
                if (hi == oeFrontIdx) doAfterStatus(h.outStatus, 1, afterESkillTrgs[hi], aswhidx, eswhidx, 1);
            });
            aHeros.forEach((h, hi) => {
                doAfterStatus(h.inStatus, 0, afterASkillTrgs[hi], aswhidx, eswhidx);
                if (hi == hidx) doAfterStatus(h.outStatus, 1, afterASkillTrgs[hi], aswhidx, eswhidx);
            });
            for (const smn of clone(this.player.summon)) {
                ([`after-skilltype${skill.type}`, `after-skill`] as Trigger[]).forEach(trg => {
                    const smnres = newSummonee(smn.id).handle(smn, { heros: bHeros.at(-1) ?? [], trigger: trg, hcard: curCard });
                    if (smnres?.trigger?.includes(trg)) calcAtk(smnres, 'summon', smn.id, aswhidx, eswhidx);
                });
            }
        }
        if (isSwitchOppo(skillcmds)) {
            const { statusIdsAndPidx } = this._doStatus(this.playerIdx ^ 1, 1, 'change-from', { hidxs: [oeFrontIdx], isExec: false, heros: eaHeros });
            if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
            doAfterStatus(eaHeros[oeFrontIdx].inStatus, 0, ['change-from'], aswhidx, eswhidx, 1, true);
            doAfterStatus(eaHeros[oeFrontIdx].outStatus, 1, ['change-from'], aswhidx, eswhidx, 1, true);
        }
        if (sidx == -1 || isSwitchSelf(skillcmds)) {
            const dtriggers: Trigger[] = [];
            if (typeof otriggers == 'string') dtriggers.push(otriggers);
            else dtriggers.push(...otriggers);
            const triggers: Trigger[] = sidx == -1 ? dtriggers : ['change-from'];
            const { statusIdsAndPidx } = this._doStatus(this.playerIdx, 1, triggers, { hidxs: [hidx], isExec: false, heros: aHeros });
            if (statusIdsAndPidx.length > 0) isSwitchAtk = true;
            doAfterStatus(aHeros[ahidx].inStatus, 0, triggers, aswhidx, eswhidx, 0, true);
            doAfterStatus(aHeros[hidx].outStatus, 1, triggers, aswhidx, eswhidx, 0, true);
        }
        if (!isExec) {
            this.willHp = new Array(ahlen + ehlen).fill(0).map((_, i) => {
                const allHeal = bWillHeal.reduce((a, b) => a + Math.max(0, b[i]), 0);
                const alldamage = bWillDamages.reduce((a, b) => a + Math.max(0, b[i][0]) + Math.max(0, b[i][1]), 0);
                const hasVal = bWillDamages.some(v => v[i][0] >= 0 || v[i][1] > 0) || bWillHeal.some(v => v[i] > 0);
                if (!hasVal) {
                    if (bWillHeal.some(v => v[i] == 0)) return 100;
                    return undefined;
                }
                const res = allHeal - alldamage;
                const hero = this.players[Math.floor(i / 3) ^ 1].heros[i % 3];
                if (res + hero.hp <= 0) {
                    if (hero.talentSlot?.subType.includes(-4)) {
                        const reviveSlot = cardsTotal(hero.talentSlot.id)
                            .handle(hero.talentSlot, { trigger: 'will-killed' })
                            .execmds?.find(v => v.cmd == 'revive')?.cnt ?? 0;
                        if (reviveSlot > 0) {
                            return reviveSlot - hero.hp - 0.3;
                        }
                    }
                    const isReviveSts = hero.inStatus.find(ist => ist.type.includes(13));
                    if (isReviveSts) {
                        return (heroStatus(isReviveSts.id).handle(isReviveSts)?.cmds?.find(v => v.cmd == 'revive')?.cnt ?? 0) - hero.hp - 0.3;
                    }
                }
                return res;
            });
        }
        this.willAttachs = isExec ? new Array(ahlen + ehlen).fill(0).map(() => []) : bWillAttach.map(hwa => hwa.filter(wa => wa > 0));
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
            this.summonCnt = this.summonCnt.map((smns, pi) => {
                const osmn = (pi == this.playerIdx ? this.player : this.opponent).summon;
                return smns.map((_, si) => {
                    if (osmn.length - 1 < si) return 0;
                    const smnCnt = (pi == this.playerIdx ? aSummon : esummon).find(smn => smn.id == osmn[si].id)?.useCnt ?? 0;
                    return smnCnt - osmn[si].useCnt;
                });
            });
        }
        bWillHeal.forEach(willheal => this._doHeal(willheal, aHeros, { isExec }))
        if (sidx == -1) return;

        if (!isOnlyRead && currSkill.name == skill.name || isReadySkill) {
            if (!isValid) return this._sendTip('骰子不符合要求');
            this.canAction = false;
            this.isFall = false;
            this.modalInfo = { ...NULL_MODAL };
            this.player.heros = aHeros;
            this.opponent.heros = eaHeros;
            this.taskQueue.addStatusAtk(statusIds);
            this.socket.emit('sendToServer', {
                dices: ndices,
                edices,
                currSkill: skill,
                handCards: skillres.handCards?.filter((c: Card) => !c.selected),
                heros: aHeros,
                eheros: eaHeros,
                summonee: aSummon,
                esummon,
                tarhidx: hidx,
                etarhidx: eFrontIdx,
                elTips: aElTips,
                willDamage: isCdt(skill.damage > 0 || aWillDamages.some(d => Math.max(0, d[0]) + d[1] > 0), aWillDamages),
                willAttachs: aWillAttach,
                dmgElements,
                willHeals: isCdt(aWillHeal.some(v => v > -1), aWillHeal),
                skillcmds: [skillcmds, eskillcmds],
                site: this.player.site,
                playerInfo: this.player.playerInfo,
                isEndAtk: ebHeros.length == 1 && !isSwitchAtk && this.taskQueue.isTaskEmpty(),
                flag: `useSkill-${skill.name}-${this.playerIdx}`,
            });
            if (!curCard.subType.includes(7) || !isCard) this.cancel();
            return;
        }
        if (!isCard) {
            if (!isOnlyRead) {
                this.player.diceSelect = [...this.checkSkill(sidx, isSwitch)];
                this.isValid = true;
            } else {
                this.player.diceSelect = this.player.dice.map(() => false);
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
        const skill = (isSwitch > -1 ? (this._calcSkillChange(1, isSwitch, { isSwitch: true }) ?? []) as Skill[] : this.skills)[sidx];
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
            const { isQuickAction: slotiqa } = this._doSlot('kill', {
                pidx: this.playerIdx ^ 1,
                heros: this.opponent.heros,
                isExec: false,
            });
            stsIsEndAtk &&= !slotiqa;
            const { isQuickAction: stsiqa } = this._doStatus(this.playerIdx ^ 1, 4, 'kill', { intvl: [100, 100, 100, 100], isOnlyFront: true });
            stsIsEndAtk &&= !stsiqa;
            const { cmds } = this._doStatus(this.playerIdx, 4, 'killed', { hidxs: [this.player.hidx], hidx });
            const { heros } = this._doCmds(cmds);
            if (heros) this.player.heros = heros;
        } else {
            let changeHeroDiceCnt = this._calcHeroChangeDice(hidx, this.player.hidx, true);
            isQuickAction = this._doSkill5(this.player.hidx, 'change-from').isQuickAction;
            changeHeroDiceCnt = this._doSlot('change', { hidxs: this.player.hidx, changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            const { isQuickAction: stsiqa, changeHeroDiceCnt: stschd } = this._doStatus(this.playerIdx, 4, 'change-from', { isQuickAction, changeHeroDiceCnt, isOnlyFront: true });
            isQuickAction = stsiqa;
            changeHeroDiceCnt = stschd;
            changeHeroDiceCnt = this._doSlot(['change-from'], { hidxs: this.player.hidx, changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            changeHeroDiceCnt = this._doSlot(['change'], { hidxs: [1, 2].map(v => (this.player.hidx + v) % 3), changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            changeHeroDiceCnt = this._doSlot(['change-to'], { hidxs: hidx, changeHeroDiceCnt, summons: this.player.summon }).changeHeroDiceCnt;
            const { cmds: sitecmd, outStatus: siteost, isQuickAction: stiqa } = this._doSite(this.playerIdx, 'change', { isQuickAction, changeHeroDiceCnt, hidx });
            isQuickAction = stiqa;
            cmds.push(...sitecmd);
            outStatus.push(...siteost);
        }
        this._doStatus(this.playerIdx, 1, 'change-from', { hidxs: [this.player.hidx], isQuickAction: isCdt(isQuickAction, 2) });
        this.player.heros[this.player.hidx].outStatus = this._updateStatus(outStatus, this.player.heros[this.player.hidx].outStatus).nstatus;
        const { heros } = this._doCmds(cmds);
        if (heros) this.player.heros = heros;
        this.socket.emit('sendToServer', {
            hidx,
            cpidx: this.playerIdx,
            isChangeHero: true,
            dices: isCdt(!dieChangeBack, newDices),
            heros: this.player.heros,
            eheros: this.opponent.heros,
            site: this.player.site,
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
    rollDice(dices?: DiceVO[], options: { pidx?: number, frontIdx?: number } = {}) {
        const { pidx = this.playerIdx, frontIdx } = options;
        const tmpDice: [number, number][] = new Array(8).fill(0).map((_, i) => [i, 0]);
        const scnt = dices?.filter(d => !d.isSelected).length ?? 0;
        let diceLen = 8;
        const player = this.players[pidx];
        if (dices != undefined) {
            dices.forEach(d => {
                if (!d.isSelected) ++tmpDice[d.val][1];
            });
            diceLen = frontIdx != undefined ? dices.length : player.dice.length;
        } else {
            if (player.dice.length > 0) return;
            player.heros.forEach((h, hi) => {
                [h.artifactSlot, h.talentSlot, h.weaponSlot].forEach(slot => {
                    if (slot != null) {
                        const slotres = cardsTotal(slot.id).handle(slot, { heros: player.heros, hidxs: [hi], trigger: 'phase-dice' });
                        if (slotres.trigger?.includes('phase-dice')) {
                            const { element = 0, cnt = 0 } = slotres;
                            tmpDice[element][1] += cnt;
                            diceLen -= cnt;
                        }
                    }
                });
            });
            player.site.forEach(site => {
                const siteres = newSite(site.id, site.card.id).handle(site);
                if (siteres.trigger?.includes('phase-dice')) {
                    let { element = 0, cnt = 0, addRollCnt = 0 } = siteres;
                    if (element == -2) element = this._getFrontHero(pidx).element;
                    tmpDice[element][1] += cnt;
                    diceLen -= cnt;
                    this.rollCnt += addRollCnt;
                }
            });
        }
        const isDone = dices != undefined && --this.rollCnt == 0;
        if (isDone) this.showRerollBtn = false;
        for (let i = 0; i < diceLen - scnt; ++i) {
            if (process.env.NODE_ENV == 'development') ++tmpDice[0][1];
            else ++tmpDice[Math.floor(Math.random() * 8)][1];
        }
        const weight = (h: Hero) => Number(player.heros.findIndex(v => v.id == h.id) != frontIdx);
        const heroEle = [...player.heros]
            .sort((a, b) => {
                if (frontIdx == undefined) return Number(!a.isFront) - Number(!b.isFront);
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
        if (frontIdx == undefined) this.modalInfo = { ...NULL_MODAL };
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
     * @param pidx 0敌方 1我方
     * @param siidx 场地idx
     */
    showSiteInfo(pidx: number, siidx: number) {
        if (this.player.site.some(s => s.canSelect)) {
            this.modalInfo = { ...NULL_MODAL };
        } else {
            const sites = [this.opponent.site, this.player.site];
            this.modalInfo = {
                isShow: true,
                type: 5,
                info: sites[pidx][siidx].card,
            }
        }
    }
    /**
     * 结束回合
     */
    endPhase() {
        if (this.player.status == 0 || !this.canAction || this.phase > PHASE.ACTION) return;
        this._doStatus(this.playerIdx, 4, ['end-phase', 'any-end-phase'], { intvl: [100, 500, 500, 200], phase: PHASE.ACTION_END });
        this._doStatus(this.playerIdx ^ 1, 4, 'any-end-phase', { intvl: [100, 500, 500, 200], phase: PHASE.ACTION_END });
        this._doSummon(this.playerIdx, 'end-phase', { isUnshift: true });
        this._execTask();
        this.socket.emit('sendToServer', {
            endPhase: true,
            heros: this.player.heros,
            eheros: this.opponent.heros,
            isEndAtk: this.taskQueue.isTaskEmpty(),
            flag: 'endPhase-' + this.playerIdx
        });
        this.cancel();
    }
    /**
     * 选择观战玩家
     * @param idx 要观战的玩家idx
     */
    lookonTo(idx: number) {
        if (this.isLookon == -1) return;
        this.playerIdx = idx;
        this.roomInfoUpdate({ isFlag: true });
        this.handCards = [...this.players[idx].handCards];
    }
    /**
     * 发出提示
     * @param content 提示内容
     * @param top 距离top的距离(默认: 50%)
     * @param color 字体颜色(默认: black)
     * @param time 提示持续时间(默认: 1200)
     */
    async _sendTip(content: string, top?: string, color?: string, time?: number) {
        await this._wait(() => this.actionInfo == '', { delay: 0, freq: 100 });
        this.tip.content = content;
        if (top) this.tip.top = top;
        if (color) this.tip.color = color;
        setTimeout(() => {
            this.tip = { content: '' };
            this.cancel();
        }, time ?? 1200);
    }
    /**
     * 发送当前行动信息
     * @param time 延迟时间
     */
    _sendActionInfo(time = 2000) {
        this.actionInfo = this.log.at(-1) || '';
        setTimeout(() => {
            this.actionInfo = '';
            this.isShowDmg = false;
            this.elTips.forEach((_, i, a) => a[i] = ['', 0, 0]);
            this.cancel();
        }, time);
    }
    /**
     * 获取当前出战角色信息
     * @param pidx 玩家idx 默认为playerIdx -1为playerIdx^1
     * @returns 当前出战角色信息
     */
    _getFrontHero(pidx: number = this.playerIdx): Hero {
        if (pidx == -1) pidx = this.playerIdx ^ 1;
        const player = this.players[pidx];
        return player?.heros?.[player?.hidx] ?? herosTotal(0);
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
            const attachEl = attachElSts == undefined ? 0 : heroStatus(attachElSts.id).handle(attachElSts, { heros: aheros, hidx: ahidx })?.attachEl ?? 0;
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
                    if (stsres.onlyOne) {
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
                if (stsres.isUpdateAttachEl && nheros) updateAttachEl(nheros, chidx, sts.group);
            }
            if (ohidx > -1 || (sts.useCnt == 0 || sts.roundCnt == 0) && !sts.type.some(t => [1, 9, 15].includes(t))) {
                if (sts.type.includes(8) && nheros) updateAttachEl(nheros, chidx, sts.group);
            }
        });
        return {
            nstatus: oriStatus.sort((a, b) => Math.sign(a.summonId) - Math.sign(b.summonId))
                .filter(sts => (sts.useCnt != 0 && sts.roundCnt != 0) || sts.type.some(t => [1, 9, 15].includes(t))),
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
            if (smn.statusId > 0) {
                let smnStatus = outStatus.find(ost => ost.id == smn.statusId);
                if (smnStatus == undefined && smn.useCnt > 0) {
                    smnStatus = heroStatus(smn.statusId, smn.id);
                    const nsts = this._updateStatus([smnStatus], outStatus).nstatus;
                    outStatus.length = 0;
                    outStatus.push(...nsts);
                }
                if (smnStatus) smnStatus.useCnt = smn.useCnt;
            }
            if (smn.useCnt == 0 && (smn.isDestroy == 0 || smn.isDestroy == 1 && trigger == 'phase-end') ||
                smn.isDestroy == 2 && trigger == 'phase-end') {
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
        esummon: Summonee[], aheros: Hero[], asummon: Summonee[],
        options: {
            isAttach?: boolean, isSummon?: number, pidx?: number, isExec?: boolean, isChargedAtk?: boolean, isWind?: boolean,
            skidx?: number, sktype?: number, isFallAtk?: boolean, isReadySkill?: boolean, isWindExec?: boolean, willheals?: number[],
            elrcmds?: Cmds[][], atriggers?: Trigger[][], etriggers?: Trigger[][], usedDice?: number, dmgElements?: number[],
            minusDiceSkill?: number[][], elTips?: [string, number, number][], willAttachs?: number[],
        } = {}) {
        const { isAttach = false, isSummon = -1, pidx = this.playerIdx, isWind = false, isExec = true, isChargedAtk = false,
            skidx = -1, sktype = -1, isReadySkill = false, isWindExec = true, isFallAtk = false, willheals = new Array(aheros.length + eheros.length).fill(-1),
            elrcmds = [[], []], usedDice = 0, dmgElements = new Array(eheros.length).fill(0), minusDiceSkill, willAttachs = new Array(eheros.length).fill(0),
            elTips = new Array(aheros.length + eheros.length).fill(0).map(() => ['', 0, 0]), atriggers: atrg = new Array(aheros.length).fill(0).map(() => []),
            etriggers: etrg = new Array(eheros.length).fill(0).map(() => []) } = options;
        let resdmg = willDamage;
        if (!isWind) {
            if (willDamage.length == 0) resdmg = new Array(aheros.length + eheros.length).fill(0).map(() => [-1, 0]);
            else if (willDamage.length == eheros.length) {
                const admg = new Array(aheros.length).fill(0).map(() => [-1, 0]);
                if (pidx == 0) resdmg = willDamage.concat(admg);
                else resdmg = admg.concat(willDamage);
            } else if (pidx == 1) {
                resdmg = willDamage.slice(eheros.length).concat(willDamage.slice(0, eheros.length));
            }
        }
        let res = {
            willDamage: clone(resdmg),
            willAttachs: [...willAttachs],
            dmgElements: [...dmgElements],
            eheros: clone(eheros),
            esummon: clone(esummon),
            aheros: clone(aheros),
            asummon: clone(asummon),
            elTips: clone(elTips),
            atriggers: clone(atrg),
            etriggers: clone(etrg),
            willheals: clone(willheals),
            elrcmds: clone(elrcmds),
            minusDiceSkill: clone(minusDiceSkill),
            siteCnt: [[0, 0, 0, 0], [0, 0, 0, 0]],
        };
        const epidx = pidx ^ 1;
        const oeheros = clone(eheros);
        const attachElements = eheros.map(h => [...h.attachElement]);
        let efhero = res.eheros[frontIdx];
        if (efhero.hp <= 0) return res;
        const getDmgIdxOffset = eheros.length * pidx;
        const getDmgIdx = frontIdx + getDmgIdxOffset;
        const aFrontIdx = getAtkHidx(aheros);
        let afhero = res.aheros[aFrontIdx];
        const isElReaction: number[] = new Array(8).fill(0);
        const isElStatus = [false, false]; // [绽放, 激化]
        if (res.willDamage[getDmgIdx][0] > 0 || isAttach) {
            res.dmgElements[frontIdx] = willAttach;
            if (!attachElements[frontIdx].includes(willAttach) && ![5, 6].includes(willAttach)) res.willAttachs[frontIdx] = willAttach;
            if ([0, 2].includes(willAttach) && efhero.inStatus.some(ist => ist.id == 2004)) { // 碎冰
                const freezeIdx = res.eheros[frontIdx].inStatus.findIndex(ist => ist.id == 2004);
                res.eheros[frontIdx].inStatus.splice(freezeIdx, 1);
                res.willDamage[getDmgIdx][0] += 2;
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
                const elTipIdx = (pidx ^ +isAttach) * 3 + frontIdx;
                if (willAttach == 5 && attachElement < 5) { // 扩散
                    const otheridx = new Array(eheros.length - 1).fill(0).map((_, i) => (frontIdx + i + 1) % eheros.length);
                    otheridx.forEach((i, idx) => {
                        if (res.willDamage[i + getDmgIdxOffset][0] < 0) res.willDamage[i + getDmgIdxOffset][0] = 0;
                        ++res.willDamage[i + getDmgIdxOffset][0];
                        res = this._elementReaction(attachElement, res.willDamage, i,
                            res.eheros, res.esummon, res.aheros, res.asummon,
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
                    ++res.willDamage[getDmgIdx][0];
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
                        res.willDamage[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = [attachType == 6 ? '蒸发' : '融化', willAttach, attachElement];
                    } else if (hasEls(1, 3) || hasEls(3, 4)) { // 水雷 感电  冰雷 超导
                        if (!isAttach) {
                            res.willDamage.forEach((dmg, i) => {
                                if (i >= pidx * aheros.length && i < pidx * aheros.length + eheros.length) {
                                    const idx = +(i != getDmgIdx);
                                    if (dmg[idx] < 0) dmg[idx] = 0;
                                    ++dmg[idx];
                                }
                            });
                        }
                        res.elTips[elTipIdx] = [attachType == 10 ? '感电' : '超导', willAttach, attachElement];
                    } else if (hasEls(1, 4)) { // 水冰 冻结
                        res.willDamage[getDmgIdx][0] += +!isAttach;
                        efhero.inStatus = this._updateStatus([heroStatus(2004)], efhero.inStatus).nstatus;
                        res.elTips[elTipIdx] = ['冻结', willAttach, attachElement];
                    } else if (hasEls(1, 7)) { // 水草 绽放
                        ++res.willDamage[getDmgIdx][0];
                        isElStatus[0] = true;
                        res.elTips[elTipIdx] = ['绽放', willAttach, attachElement];
                    } else if (hasEls(2, 3)) { // 火雷 超载
                        res.willDamage[getDmgIdx][0] += 2;
                        if (efhero.isFront) res.elrcmds[0].push({ cmd: 'switch-after', cnt: 2500 });
                        res.elTips[elTipIdx] = ['超载', willAttach, attachElement];
                    } else if (hasEls(2, 7)) { // 火草 燃烧
                        ++res.willDamage[getDmgIdx][0];
                        res.asummon = this._updateSummon([newSummonee(3002)], res.asummon, afhero.outStatus, { isSummon });
                        res.elTips[elTipIdx] = ['燃烧', willAttach, attachElement];
                    } else if (hasEls(3, 7)) { // 雷草 原激化
                        ++res.willDamage[getDmgIdx][0];
                        isElStatus[1] = true;
                        res.elTips[elTipIdx] = ['原激化', willAttach, attachElement];
                    }
                    [1, 2, 3, 4, 7].filter(el => attachType >> el & 1).forEach(el => isElReaction[el] = 1);
                }
            }
            res.eheros[frontIdx].attachElement = attachElements[frontIdx];
        }
        const atriggers: Trigger[][] = new Array(aheros.length).fill(0).map(() => []);
        const etriggers: Trigger[][] = new Array(eheros.length).fill(0).map(() => []);
        etriggers.forEach((trg, tidx) => {
            const [elDmg, penDmg] = res.willDamage[tidx + getDmgIdxOffset];
            const isOtherGetDmg = res.willDamage
                .slice(eheros.length * pidx, eheros.length * pidx + aheros.length)
                .some((dmg, didx) => (dmg[0] > 0 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || penDmg > 0) {
                trg.push('getdmg');
                if (willAttach > 0) trg.push('el-getdmg');
                if (elDmg > 0) trg.push(`${ELEMENT_ICON[willAttach]}-getdmg` as Trigger);
                if (penDmg > 0) trg.push('pen-getdmg');
            }
        });
        atriggers.forEach((trg, tidx) => {
            const [elDmg, penDmg] = res.willDamage[tidx + (aheros.length * epidx)];
            const isOtherGetDmg = res.willDamage
                .slice(aheros.length * epidx, aheros.length * epidx + eheros.length)
                .some((dmg, didx) => (dmg[0] > 0 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || penDmg > 0) {
                trg.push('getdmg');
                if (elDmg > 0) trg.push(`${ELEMENT_ICON[willAttach]}-getdmg` as Trigger);
                if (penDmg > 0) trg.push('pen-getdmg');
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
        const aist: Status[][] = new Array(aheros.length).fill(0).map(() => []);
        const aost: Status[] = [];
        const eist: Status[][] = new Array(eheros.length).fill(0).map(() => []);
        const eost: Status[] = [];
        if (!isAttach) {
            if (isWind) {
                etriggers[frontIdx].push(`${ELEMENT_ICON[willAttach]}-getdmg-wind` as Trigger);
                if (!atriggers[aFrontIdx].includes(`${ELEMENT_ICON[willAttach]}-dmg-wind` as Trigger)) {
                    atriggers[aFrontIdx].push(`${ELEMENT_ICON[willAttach]}-dmg-wind` as Trigger);
                }
            } else {
                const eWillDamage = res.willDamage.slice(pidx * aheros.length, pidx * aheros.length + eheros.length);
                if (eWillDamage.some(dmg => dmg[0] > 0) || eWillDamage.some(dmg => dmg[1] > 0)) {
                    atriggers[aFrontIdx].push('dmg', 'getdmg-oppo');
                    if (willAttach > 0) atriggers[aFrontIdx].push('el-dmg', 'el-getdmg-oppo');
                    if (eWillDamage.some(dmg => dmg[0] > 0)) {
                        atriggers[aFrontIdx].push(`${ELEMENT_ICON[willAttach]}-dmg` as Trigger, `${ELEMENT_ICON[willAttach]}-getdmg-oppo` as Trigger);
                    }
                    if (eWillDamage.some(dmg => dmg[1] > 0)) {
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
                    summons: res.asummon,
                    isChargedAtk,
                    isFallAtk,
                    isSkill: skidx,
                    usedDice,
                    isExec,
                    minusDiceSkill: res.minusDiceSkill,
                    card: this.currCard,
                });
                aist[i].push(...(slotres.inStatus ?? []));
                aost.push(...(slotres.outStatus ?? []));
                slotSummons.push(...(slotres.summon ?? []));
                slotres.willHeals.forEach((hl, hli) => {
                    if (hl >= 0) {
                        const nhli = hli + epidx * res.aheros.length;
                        if (res.willheals[nhli] < 0) res.willheals[nhli] = hl;
                        else res.willheals[nhli] += hl;
                    }
                });
                if (res.willDamage[getDmgIdx][0] > 0) res.willDamage[getDmgIdx][0] += slotres.addDmg + (isSummon > -1 ? slotres.addDmgSummon : 0);
                if (skidx > -1) res.minusDiceSkill = slotres.minusDiceSkill;
            }
            res.asummon = this._updateSummon(slotSummons, res.asummon, afhero.outStatus, { isSummon });
            const getdmg = res.willDamage
                .slice(aheros.length * pidx, aheros.length * pidx + eheros.length)
                .map(dmg => Math.max(0, dmg[0]) + dmg[1]);
            for (let i = 0; i < res.eheros.length; ++i) {
                const slotres = this._doSlot(etriggers[i], {
                    hidxs: i,
                    pidx: epidx,
                    heros: res.eheros,
                    eheros: res.aheros,
                    isExec,
                    getdmg,
                });
                eist[i].push(...(slotres.inStatus ?? []));
                eost.push(...(slotres.outStatus ?? []));
                res.eheros.forEach((h, hi) => {
                    const hli = hi + pidx * eheros.length;
                    if (slotres.willHeals[hi] > 0 && h.hp > res.willDamage[hi + getDmgIdxOffset].reduce((a, b) => a + Math.max(0, b))) {
                        if (res.willheals[hli] == -1) res.willheals[hli] = slotres.willHeals[hi];
                        else res.willheals[hli] = Math.min(h.maxhp - h.hp, (res.willheals[hli] ?? 0) + slotres.willHeals[hi]);
                    }
                });
            }
        }
        const doStatus = (status: Status[], isOppo: boolean, trgs: Trigger[], hi: number) => {
            const dmg = isOppo ? 'getDmg' : 'addDmgCdt';
            for (const sts of status) {
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
                        hasDmg: res.willDamage[getDmgIdx][0] > 0,
                        isSkill: skidx,
                        dmgSource: skidx > -1 ? afhero.id : isSummon,
                        card: this.currCard,
                        minusDiceSkill: res.minusDiceSkill,
                    });
                    const skillAddDmgTrgs: Trigger[] = [`skilltype${sktype}` as Trigger, 'skill'];
                    if (sts.type.includes(6) && isReadySkill && skillAddDmgTrgs.some(trg => stsres.trigger?.includes(trg))) {
                        stsres.trigger = [...(stsres.trigger ?? []), 'useReadySkill']
                    }
                    if (this._hasNotTrigger(stsres.trigger, trigger)) continue;
                    if (res.willDamage[getDmgIdx][0] > 0) {
                        res.willDamage[getDmgIdx][0] += (stsres?.[`${dmg}`] ?? 0) + (isSummon > -1 ? stsres.addDmgSummon ?? 0 : 0);
                    }
                    if (stsres.summon && !isOppo) {
                        res.asummon = this._updateSummon(stsres.summon, res.asummon, afhero.outStatus);
                    }
                    if (stsres.cmds) res.elrcmds[+isOppo].push(...stsres.cmds);
                    if (skidx > -1 && !isOppo) res.minusDiceSkill = stsres.minusDiceSkill;
                    if (!sts.type.includes(1)) {
                        if (stsres.heal) {
                            const stshl = stsres.heal ?? 0;
                            (stsres.hidxs ?? [aFrontIdx]).forEach(hlhidx => {
                                const hli = hlhidx + (isOppo ? (pidx * res.eheros.length) : (epidx * res.aheros.length));
                                if (res.willheals[hli] < 0) res.willheals[hli] = stshl;
                                else res.willheals[hli] += stshl;
                            });
                        }
                        if (stsres.pendamage) {
                            (stsres.hidxs ?? allHidxs(res.eheros, { exclude: frontIdx })).forEach(hi => {
                                res.willDamage[hi + getDmgIdxOffset][1] += stsres.pendamage ?? 0;
                            });
                        }
                    } else if (isExec) {
                        this.taskQueue.addStatusAtk([{
                            id: sts.id,
                            type: sts.group,
                            pidx: isOppo ? epidx : pidx,
                            isOppo: +!!stsres.isOppo,
                            trigger
                        }], trigger == 'getdmg');
                    }
                    // else if (trigger.startsWith('skill')) {
                    //     (isOppo ? res.etriggers : res.atriggers)[hi].push('after-' + trigger as Trigger);
                    // }
                    if (stsres.exec && isWindExec && !sts.type.includes(11)) {
                        const { inStatus = [], outStatus = [], inStatusOppo = [], outStatusOppo = [], hidxs = [], cmds = [] } = stsres.exec() ?? {};
                        (hidxs ?? [aFrontIdx]).forEach(hi => aist[hi].push(...inStatus));
                        aost.push(...outStatus);
                        (hidxs ?? [frontIdx]).forEach(hi => eist[hi].push(...inStatusOppo));
                        eost.push(...outStatusOppo);
                        res.elrcmds[+isOppo].push(...cmds);
                    }
                }
            }
        }
        atriggers.forEach((t, ti) => {
            res.atriggers[ti] = [...new Set([...res.atriggers[ti], ...t])];
        });
        etriggers.forEach((t, ti) => {
            res.etriggers[ti] = [...new Set([...res.etriggers[ti], ...t])];
        });
        res.aheros.forEach((h, hi) => {
            doStatus(h.inStatus, false, res.atriggers[hi], hi);
            if (hi == aFrontIdx) doStatus(h.outStatus, false, res.atriggers[hi], hi);
        });
        res.eheros.forEach((h, hi) => {
            doStatus(h.inStatus, true, res.etriggers[hi], hi);
            if (hi == frontIdx) doStatus(h.outStatus, true, res.etriggers[hi], hi);
        });
        if (!isWind) {
            const getdmg = res.willDamage.map(v => v[0] + v[1]);
            const { cmds: sitecmds, siteCnt, minusDiceSkill: sitemds } = this._doSite(pidx, atriggers[aFrontIdx], {
                isExec,
                isSkill: skidx,
                getdmg,
                minusDiceSkill: res.minusDiceSkill,
                heal: res.willheals,
            });
            res.elrcmds[0].push(...sitecmds);
            res.siteCnt[pidx].forEach((_, i, a) => a[i] += siteCnt[pidx][i]);
            res.minusDiceSkill = sitemds;
            const { cmds: siteoppocmds, siteCnt: siteOppoCnt } = this._doSite(epidx, [...new Set(etriggers.flat())], {
                isExec,
                getdmg,
                isSkill: skidx,
            });
            res.elrcmds[0].push(...siteoppocmds);
            res.siteCnt[epidx].forEach((_, i, a) => a[i] += siteOppoCnt[epidx][i]);
            const { smncmds: esmncmd } = this._doSummon(epidx, [...new Set(etriggers.flat())], { csummon: res.esummon, eheros: res.aheros, isExec });
            const { heros: smneheros } = this._doCmds(esmncmd, { pidx: epidx, heros: res.eheros, isExec });
            if (smneheros) {
                res.eheros = [...smneheros];
                efhero = res.eheros[frontIdx];
            }
            const { addDmg, willheals = [], minusDiceSkill: smnmds } = this._doSummon(pidx, atriggers[aFrontIdx], {
                csummon: res.asummon,
                isDmg: true,
                isChargedAtk,
                isFallAtk,
                isExec,
                heros: res.aheros,
                hcard: this.currCard,
                minusDiceSkill: res.minusDiceSkill,
                isSkill: skidx,
            });
            afhero = res.aheros[aFrontIdx];
            if (res.willDamage[getDmgIdx][0] > 0) res.willDamage[getDmgIdx][0] += addDmg;
            willheals.forEach((hl, hli) => {
                if (hl >= 0) {
                    if (res.willheals[hli] < 0) res.willheals[hli] = hl;
                    else res.willheals[hli] += hl;
                }
            });
            res.minusDiceSkill = smnmds;
        }
        res.esummon = this._updateSummon([], res.esummon, efhero.outStatus);
        res.asummon = this._updateSummon([], res.asummon, afhero.outStatus);
        if (res.atriggers[aFrontIdx].includes('el-getdmg-oppo')) {
            let elcnt = this.player.playerInfo.oppoGetElDmgType;
            for (const trg of res.atriggers[aFrontIdx]) {
                const el = ELEMENT_ICON.indexOf(trg.slice(0, trg.indexOf('-getdmg-oppo')));
                if (el == -1 || (elcnt >> el & 1) == 1) continue;
                elcnt |= (1 << el);
            }
            if (isExec) this.player.playerInfo.oppoGetElDmgType = elcnt;
        }

        let restDmg = res.willDamage[getDmgIdx][0];
        if (efhero.talentSlot?.subType.includes(-1) && efhero.isFront) {
            const { restDmg: slotresdmg = 0, inStatusOppo = [], hidxs }
                = cardsTotal(efhero.talentSlot.id).handle(efhero.talentSlot, { restDmg, heros: res.eheros, hidxs: [frontIdx] });
            restDmg = slotresdmg;
            for (const slidx of (hidxs ?? [aFrontIdx])) {
                aist[slidx].push(...inStatusOppo);
            }
        }
        efhero.inStatus.filter(ist => ist.type.some(t => [2, 7].includes(t))).forEach(ist => {
            restDmg = heroStatus(ist.id).handle(ist, { restDmg, willAttach, heros: res.eheros, hidx: frontIdx, dmgSource: isSummon })?.restDmg ?? 0;
        });
        if (efhero.isFront) {
            efhero.outStatus.filter(ost => ost.type.some(t => [2, 7].includes(t))).forEach(ost => {
                const oSummon = res.esummon.find(smn => smn.id == ost.summonId);
                const { restDmg: nrdmg = 0, pendamage = 0, hidxs: penhidxs = [] } = heroStatus(ost.id).handle(ost, {
                    restDmg,
                    summon: oSummon,
                    willAttach,
                    heros: res.eheros,
                    hidx: frontIdx,
                });
                restDmg = nrdmg;
                if (pendamage > 0 && penhidxs.length > 0) {
                    penhidxs.forEach(v => res.willDamage[v + getDmgIdxOffset][1] += pendamage);
                }
            });
            afhero.outStatus.filter(ost => ost.type.includes(5)).forEach(ost => {
                restDmg = heroStatus(ost.id).handle(ost, { restDmg })?.restDmg ?? 0;
            });
        }
        res.willDamage[getDmgIdx][0] = restDmg;
        res.aheros.forEach((h, hi) => res.willheals[hi + epidx * res.aheros.length] = Math.min(h.maxhp - h.hp, res.willheals[hi + epidx * res.aheros.length]));
        res.eheros.forEach((h, hi) => res.willheals[hi + pidx * res.eheros.length] = Math.min(h.maxhp - h.hp, res.willheals[hi + pidx * res.eheros.length]));
        this._doSkill5(frontIdx, etriggers[frontIdx], { pidx: pidx ^ 1, heros: res.eheros, isExec, getdmg: restDmg });

        if (isElReaction[6] > 0) aost.push(heroStatus(2007));
        if (isElStatus[0] && [...aost, ...res.aheros[aFrontIdx].outStatus].every(ost => ost.id != 2111)) aost.push(heroStatus(2005));
        if (isElStatus[1]) aost.push(heroStatus(2006));
        const stscmds: Cmds[] = [];
        res.aheros.forEach((_, i) => {
            if (aist[i].length) stscmds.push({ cmd: 'getInStatus', status: aist[i], hidxs: [i] })
        });
        res.eheros.forEach((_, i) => {
            if (eist[i].length) stscmds.push({ cmd: 'getInStatusOppo', status: eist[i], hidxs: [i] })
        });
        stscmds.push({ cmd: 'getOutStatus', status: aost });
        stscmds.push({ cmd: 'getOutStatusOppo', status: eost });
        this._doCmds(stscmds, { pidx, heros: res.aheros, eheros: res.eheros, ahidx: aFrontIdx, ehidx: frontIdx, isEffectHero: true });
        if (isWindExec && isExec) {
            this._doStatus(epidx, 1, 'status-destroy', { heros: res.eheros, eheros: res.aheros, isUnshift: true });
            if (res.willDamage.some(d => Math.max(0, d[0]) + d[1] > 0)) {
                const willkilledhidxs: number[] = [];
                res.eheros.forEach((h, hi) => {
                    if (h.hp <= res.willDamage[hi + getDmgIdxOffset].reduce((a, b) => a + b)) {
                        willkilledhidxs.push(hi);
                    }
                });
                if (willkilledhidxs.length > 0) {
                    const dieHeros: [Hero, number][] = clone(res.eheros.filter((_, hi) => willkilledhidxs.includes(hi)).map(h1 => [h1, res.eheros.findIndex(h2 => h2.id == h1.id)]));
                    const { nwkhidxs } = this._doSlot('will-killed', { pidx: epidx, hidxs: willkilledhidxs, heros: res.eheros, eheros: res.aheros, isUnshift: true });
                    this._doStatus(epidx, 13, 'will-killed', { intvl: [100, 100, 100, 100], hidxs: nwkhidxs, heros: res.eheros, eheros: res.aheros, isUnshift: true });
                    const slotDestroyHidxs = dieHeros.filter(([h]) => {
                        const isDie = h.inStatus.every(ist => !ist.type.includes(13)) &&
                            willkilledhidxs.length == nwkhidxs.length &&
                            (h.weaponSlot != null || h.artifactSlot != null || h.talentSlot != null);
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
                newDice.push(this._getFrontHero(pidx).element);
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
     *                isChargedAtk 是否为重击, isFallAtk 是否为下落攻击, hcard 使用的牌, minusDiceSkill 用技能减骰子, isSkill 使用技能idx, tsummon 执行task的召唤物 
     *                players 当前玩家数组, eheros 当前敌方角色组
     * @returns smncmds 命令集, addDmg 加伤, addDiceHero 增加切换角色骰子数, changeHeroDiceCnt 改变骰子数, minusDiceSkill 用技能减骰子, willheals 将回血数
     */
    _doSummon(pidx: number, ostate: Trigger | Trigger[],
        options: {
            intvl?: number[], isUnshift?: boolean, csummon?: Summonee[], isExec?: boolean, isDmg?: boolean, isExecTask?: boolean, hidx?: number,
            isChargedAtk?: boolean, isFallAtk?: boolean, hcard?: Card, minusDiceSkill?: number[][], isSkill?: number, tsummon?: Summonee[],
            players?: Player[], heros?: Hero[], eheros?: Hero[],
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostate == 'string') states.push(ostate);
        else states.push(...ostate);
        const { intvl = [100, 700, 2000, 200], isUnshift = false, csummon, isExec = true, isDmg = false, isChargedAtk = false,
            hidx = this.players[pidx].hidx, isFallAtk = false, hcard, isExecTask = false, isSkill = -1, tsummon,
            players = this.players, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros } = options;
        let { minusDiceSkill } = options;
        const p = players[pidx];
        const smncmds: Cmds[] = [];
        let addDmg = 0;
        let addDiceHero = 0;
        let changeHeroDiceCnt = 0;
        let willheals: number[] = new Array(players.reduce((a, c) => a + c.heros.length, 0)).fill(-1);
        let task: [(() => void)[], number[]] | undefined;
        const summons: Summonee[] = tsummon ?? csummon ?? [...p.summon];
        for (const state of states) {
            for (const summon of summons) {
                const summonres = newSummonee(summon.id).handle(summon, {
                    trigger: state,
                    heros,
                    eheros,
                    hidx,
                    isChargedAtk,
                    isFallAtk,
                    hcard,
                    isExec,
                    minusDiceSkill,
                    isSkill,
                });
                if (this._hasNotTrigger(summonres.trigger, state)) continue;
                if (summonres.isNotAddTask) {
                    addDmg += summonres.addDmgCdt ?? 0;
                    addDiceHero += summonres.addDiceHero ?? 0;
                    minusDiceSkill = summonres.minusDiceSkill ?? minusDiceSkill;
                    if (!isExec) continue;
                    if (summonres.exec && (!isDmg || summonres.damage == undefined)) {
                        const { cmds = [], changeHeroDiceCnt: smnDiceCnt = 0 } = summonres.exec?.({ summon, eheros }) ?? {};
                        const { changedEl } = this._doCmds(cmds, { pidx, heros, isExec });
                        if (changedEl) summon.element = changedEl;
                        smncmds.push(...cmds);
                        changeHeroDiceCnt = smnDiceCnt;
                    }
                    continue;
                }
                if (summonres.cmds) {
                    const { willHeals = [], heros: nheros } = this._doCmds(summonres.cmds, { pidx, isExec });
                    willHeals.forEach((hl, hli) => {
                        if (hl >= 0) {
                            if (willheals[hli] < 0) willheals[hli] = hl;
                            else willheals[hli] += hl;
                        }
                    });
                    if (nheros) p.heros = nheros;
                }
                if (state.startsWith('skill')) intvl[0] = 2100;
                if (isExec) {
                    if (!isExecTask) {
                        const args = Array.from(arguments);
                        args[2] = clone(args[2]) ?? {};
                        args[2].isExecTask = true;
                        args[2].tsummon = [summon];
                        this.taskQueue.addTask('summon-' + summon.name, args, isUnshift);
                    } else {
                        let aSummon = csummon ?? [...p.summon];
                        let fIsEndAtk = true;
                        const summonHandle = [
                            () => { // 边框亮起
                                this.socket.emit('sendToServer', {
                                    cpidx: pidx,
                                    currSummon: summon,
                                    step: 1,
                                    flag: `_doSummon1-${summon.name}-${pidx}`,
                                });
                            },
                            () => { // 扣血、显示伤害、效果变化
                                console.info(`[${p.name}]${state}:${summon.name}.useCnt:${summon.useCnt}->${summon.useCnt - 1}`);
                                const smnexecres = summonres.exec?.({ summon: summon, heros: this.players[pidx].heros, eheros: this.players[pidx ^ 1].heros });
                                if (smnexecres?.cmds) {
                                    let { heros: eHeros, hidx: eFrontIdx, summon: eSummon } = this.players[pidx ^ 1];
                                    let { heros: aHeros, hidx: frontIdx } = this.players[pidx];
                                    let aheros: Hero[] = clone(aHeros);
                                    let eheros: Hero[] = clone(eHeros);
                                    let esummon: Summonee[] = [...eSummon];
                                    let smncmds: Cmds[] = [];
                                    let currSummon: Summonee | undefined;
                                    let willDamages: number[][] | undefined;
                                    let dmgElements: number[] = new Array(eheros.length).fill(0);
                                    let aWillAttachs: number[][] = new Array(aheros.length + eheros.length).fill(0).map(() => []);
                                    let aElTips: [string, number, number][] = new Array(aheros.length + eheros.length).fill(0).map(() => ['', 0, 0]);
                                    const { changedEl, inStatus, outStatus, heros, willHeals, ndices } = this._doCmds(smnexecres.cmds, { pidx, heal: summon.shield });
                                    if (changedEl) summon.element = changedEl;
                                    const smnIdx = aSummon.findIndex(smn => smn.id == summon.id);
                                    aSummon[smnIdx] = summon;
                                    if (heros) aheros = [...heros];
                                    if (inStatus) aheros[frontIdx].inStatus = [...inStatus[frontIdx]];
                                    if (outStatus) aheros[frontIdx].outStatus = [...outStatus];
                                    this._doHeal(willHeals, p.heros, { pidx });
                                    let isSwitchAtk = false;
                                    for (let i = 0; i < smnexecres.cmds.length; ++i) {
                                        const { cmd, hidxs, cnt, isAttach = false } = smnexecres.cmds[i];
                                        if (cmd == 'attack') {
                                            if (summon.pendamage == 0 && hidxs != undefined) eFrontIdx = hidxs[0];
                                            const bhidxs = hidxs ?? getBackHidxs(eheros);
                                            let { willDamage, willAttachs, dmgElements: dmgElements1, eheros: eheros1, esummon: esummon1,
                                                aheros: aheros1, asummon: asummon1, elrcmds: elrcmds1, elTips: elTips1 }
                                                = this._elementReaction(
                                                    summon.element,
                                                    new Array(eheros.length).fill(0).map((_, i) => [
                                                        i == eFrontIdx ? ((cnt ?? summon.damage) || -1) : -1,
                                                        bhidxs.includes(i) ? summon.pendamage : 0,
                                                    ]),
                                                    eFrontIdx,
                                                    eheros, esummon,
                                                    aheros, aSummon,
                                                    { pidx, isSummon: summon.id }
                                                );
                                            this.willDamages = [...willDamage];
                                            willDamages = this.willDamages;
                                            dmgElements = dmgElements1;
                                            aheros = [...aheros1];
                                            eheros = [...eheros1];
                                            esummon = [...esummon1];
                                            aSummon = [...asummon1];
                                            aElTips = [...elTips1];
                                            for (let i = 0; i < aheros.length; ++i) aWillAttachs[i + (pidx ^ 1) * 3].push(willAttachs[i]);
                                            smncmds.push(...elrcmds1[0]);
                                            if (elrcmds1[0].some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'))) {
                                                const { statusIdsAndPidx: stpidx } = this._doStatus(pidx ^ 1, 1, 'change-from', { hidxs: [eFrontIdx] });
                                                if (stpidx.length > 0) isSwitchAtk = true;
                                            }
                                        }
                                        if (isAttach) {
                                            const { eheros: eheros2, willAttachs, aheros: aheros2, esummon: asummon2, asummon: esummon2, elrcmds: elrcmds2, elTips: elTips2 }
                                                = this._elementReaction(
                                                    summon.element,
                                                    [],
                                                    this.players[pidx].hidx,
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
                                            for (let i = 0; i < 3; ++i) aWillAttachs[i + pidx * 3].push(willAttachs[i]);
                                        }
                                        currSummon = summon;
                                    }
                                    const willAttachs: number[][] = new Array(aheros.length + eheros.length).fill(0).map(() => []);
                                    willAttachs[eFrontIdx + (pidx ^ 1) * 3].push(summon.element);
                                    fIsEndAtk = this.taskQueue.isTaskEmpty() && !isSwitchAtk;
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
                                        currSummon,
                                        dices: ndices,
                                        heros: aheros,
                                        eheros: eheros,
                                        esummon,
                                        willAttachs,
                                        willDamage: willDamages,
                                        dmgElements,
                                        elTips: aElTips,
                                        smncmds: [...smnexecres.cmds, ...smncmds],
                                        playerInfo: this.players[pidx].playerInfo,
                                        isUseSkill: isSkill > -1,
                                        step: 2,
                                        flag: `_doSummon2-${summon.name}-${pidx}`,
                                    });
                                }
                            },
                            () => { // 边框变暗
                                this.socket.emit('sendToServer', {
                                    cpidx: pidx,
                                    currSummon: summon,
                                    summonee: aSummon,
                                    step: 3,
                                    flag: `_doSummon3-${summon.name}-${pidx}`,
                                });
                            },
                            (isEndAtk = false) => { // 更新summon数据
                                const { outStatus } = this._getFrontHero(pidx);
                                const summonee = this._updateSummon([], aSummon, outStatus, { trigger: state });
                                this.socket.emit('sendToServer', {
                                    cpidx: pidx,
                                    currSummon: summon,
                                    summonee,
                                    outStatus,
                                    isEndAtk: isEndAtk && fIsEndAtk,
                                    isQuickAction: state == 'action-start',
                                    step: 4,
                                    flag: `_doSummon4-${summon.name}-${pidx}`,
                                });
                            }
                        ];
                        task = [summonHandle, intvl];
                    }
                }
            }
        }
        return { smncmds, addDmg, addDiceHero, changeHeroDiceCnt, willheals, minusDiceSkill, csummon, task }
    }
    /**
     * 场地效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param time 当前时间
     * @param options intvl 间隔时间, changeHeroDiceCnt 切换需要的骰子, hcard 使用的牌, players 最新的玩家信息, summonDiffCnt 减少的召唤物数量, 
     *                hidx 将要切换的玩家, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列, isExec 是否执行, firstPlayer 先手玩家pidx,
     *                getdmg 受伤量, heal 回血量
     * @returns isQuickAction 是否快速行动, cmds 命令集, exchangeSite 交换的支援牌, outStatus 出战状态, minusDiceHero 减少切换角色骰子, siteCnt 支援区数量,
     *          minusDiceCard 减少使用卡骰子, minusDiceSkill 用技能减骰子
     */
    _doSite(pidx: number, ostates: Trigger | Trigger[],
        options: {
            intvl?: number[], changeHeroDiceCnt?: number, hcard?: Card, players?: Player[], summonDiffCnt?: number, firstPlayer?: number,
            isExec?: boolean, isQuickAction?: boolean, minusDiceCard?: number, csite?: Site[], hidx?: number, isSkill?: number,
            minusDiceSkill?: number[][], isExecTask?: boolean, getdmg?: number[], heal?: number[]
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostates == 'string') states.push(ostates);
        else states.push(...ostates);
        const { intvl = [100, 500, 200, 100], hcard, players = this.players, isExec = true, firstPlayer = -1, hidx = -1, isSkill = -1,
            isExecTask = false, csite, getdmg, heal } = options;
        let { changeHeroDiceCnt = 0, summonDiffCnt = 0, isQuickAction = false, minusDiceCard = 0, minusDiceSkill } = options;
        let exchangeSite: [Site, number][] = [];
        const cmds: Cmds[] = [];
        const outStatus: Status[] = [];
        let minusDiceHero = 0;
        const siteCnt = [[0, 0, 0, 0], [0, 0, 0, 0]];
        let task: [(() => void)[], number[]] | undefined;
        if (players.some(p => p.hidx < 0)) return { isQuickAction, cmds, exchangeSite, outStatus, minusDiceHero, siteCnt, task }
        const p = players[pidx];
        const imdices = [...players[pidx].dice];
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
                    eheros: players[pidx ^ 1].heros,
                    hidxs: [p.hidx],
                    hidx,
                    card: hcard,
                    hcards: players[pidx].handCards.concat(players[pidx].willGetCard),
                    isFirst: firstPlayer == pidx,
                    playerInfo: p.playerInfo,
                    minusDiceCard,
                    isSkill,
                    minusDiceSkill,
                    getdmg,
                    heal,
                });
                if (siteres.isLast && !isLast) lastSite.push(site);
                if (this._hasNotTrigger(siteres.trigger, state) || (siteres.isLast && !isLast)) continue;
                isQuickAction ||= siteres.isQuickAction ?? false;
                minusDiceHero += siteres.minusDiceHero ?? 0;
                minusDiceCard += siteres.minusDiceCard ?? 0;
                minusDiceSkill = siteres.minusDiceSkill ?? minusDiceSkill;
                const isExchange = !!siteres.isExchange && (players[pidx ^ 1].site.length + exchangeSite.filter(v => v[1] == (pidx ^ 1)).length) < 4;
                if (isExchange) exchangeSite.push([site, pidx ^ 1]);
                siteCnt[pidx][stidx] += siteres.siteCnt ?? 0;
                if (isExec) {
                    if (siteres.isNotAddTask) {
                        const siteexecres = siteres.exec?.({ isQuickAction, changeHeroDiceCnt, summonDiffCnt, minusDiceCard });
                        changeHeroDiceCnt = siteexecres?.changeHeroDiceCnt ?? 0;
                        cmds.push(...(siteexecres?.cmds ?? []));
                        outStatus.push(...(siteexecres?.outStatus ?? []));
                        if (siteexecres?.isDestroy && (!siteres.isExchange || isExchange)) destroys.push(stidx);
                    } else {
                        if (!isExecTask) {
                            const args = Array.from(arguments);
                            args[2] = clone(args[2]) ?? {};
                            args[2].isExecTask = true;
                            args[2].csite = [site];
                            this.taskQueue.addTask('site-' + site.card.name + site.sid, args);
                        } else {
                            const curIntvl = [...intvl];
                            let siteexecres: SiteExecRes = { isDestroy: false };
                            const siteHandle = [
                                () => { // 边框亮起
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
                                        currSite: site,
                                        step: 1,
                                        flag: `_doSite1-${site.card.name}${site.sid}-${pidx}`,
                                    });
                                },
                                () => { // 数量、效果变化
                                    siteexecres = siteres.exec?.({ isQuickAction, changeHeroDiceCnt, summonDiffCnt, minusDiceCard }) ?? siteexecres;
                                    console.info(`[${p.name}]${state}:${site.card.name}-${site.sid}.cnt:${site.cnt}.perCnt:${site.perCnt}`);
                                    if (siteexecres.cmds) {
                                        if (siteexecres.cmds.some((v: Cmds) => v.cmd == 'getCard')) curIntvl[2] = 2000;
                                        if (siteexecres.cmds.some((v: Cmds) => v.cmd == 'heal')) curIntvl[2] = 1000;
                                    }
                                    const { ndices, heros: nh, eheros, willHeals } = this._doCmds(siteexecres.cmds, { pidx });
                                    const heros = nh ?? this.players[pidx].heros;
                                    this._doHeal(willHeals, p.heros, { pidx });
                                    const summonee = this._updateSummon(siteres.summon ?? [], this.players[pidx].summon, heros[p.hidx].outStatus);
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
                                        heros,
                                        eheros,
                                        summonee,
                                        currSite: site,
                                        dices: ndices,
                                        siteres: siteexecres,
                                        step: 2,
                                        flag: `_doSite2-${site.card.name}${site.sid}-${pidx}`,
                                    });
                                },
                                () => { // 边框变暗
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
                                        currSite: site,
                                        site: players[pidx].site,
                                        step: 3,
                                        flag: `_doSite3-${site.card.name}${site.sid}-${pidx}`,
                                    });
                                },
                                (isEndAtk = false) => { // 更新site数据
                                    siteexecres.isDestroy &&= (!siteres.isExchange || isExchange);
                                    isQuickAction ||= state == 'action-start';
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
                                        currSite: site,
                                        site: players[pidx].site,
                                        siteres: siteexecres,
                                        isEndAtk,
                                        isQuickAction,
                                        step: 4,
                                        flag: `_doSite4-${site.card.name}${site.sid}-${pidx}`,
                                    });
                                }
                            ];
                            task = [siteHandle, curIntvl];
                        }
                    }
                } else if (siteres.summon) {
                    this.willSummons[1].push(...siteres.summon.map(smn => ({ ...smn, isWill: true })));
                }
                if (siteres.isOrTrigger) break;
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
     *                phase 当前最新阶段, players 最新玩家信息, hidxs 只执行某几个角色, hidx 用于指定角色(目前只用于断流),
     *                card 使用的卡, isOnlyInStatus 是否只执行角色状态, isOnlyOutStatus 是否只执行出战状态, heros 当前角色组,
     *                isSwitchAtk 是否切换攻击角色, taskMark 任务标记
     * @returns isQuickAction 是否有快速行动, minusDiceHero 减少切换角色的骰子,changeHeroDiceCnt 实际减少切换角色的骰子, cmds 要执行的命令, 
     *          statusIdsAndPidx 额外攻击, isInvalid 使用卡是否有效, minusDiceCard 使用卡减少骰子
    */
    _doStatus(pidx: number, otypes: number | number[], otrigger: Trigger | Trigger[],
        options: {
            intvl?: number[], isQuickAction?: boolean | number, isExec?: boolean, isOnlyFront?: boolean, changeHeroDiceCnt?: number, heal?: number[],
            phase?: number, players?: Player[], hidxs?: number[], hidx?: number,
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
            hidxs, hidx: ophidx = -1, card, isOnlyInStatus = false, isOnlyOutStatus = false, heal,
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
        const peheros = options.eheros ?? players[pidx ^ 1].heros;
        const doStatus = (stses: Status[], group: number, hidx: number, trigger: Trigger) => {
            const nist: Status[] = [];
            const nost: Status[] = [];
            const nistop: Status[] = [];
            const nostop: Status[] = [];
            for (const sts of stses) {
                if (!sts.type.some(t => types.includes(t)) || (taskMark && (taskMark[0] != hidx || taskMark[1] != group || taskMark[2] != sts.id))) continue;
                const stsres = heroStatus(sts.id).handle(sts, {
                    heros: pheros,
                    eheros: peheros,
                    hidx,
                    trigger,
                    hidxs: [ophidx],
                    phase: pidx == this.playerIdx ? phase : p.phase,
                    card,
                    minusDiceCard,
                    heal,
                    dmgElement,
                    summons: p.summon,
                    esummons: players[pidx ^ 1].summon,
                });
                if (this._hasNotTrigger(stsres.trigger, trigger)) continue;
                if (group == 1) {
                    if (isQuickAction == 1 && stsres.isQuickAction != undefined) continue;
                    if (isQuickAction < 2) isQuickAction = Number(stsres.isQuickAction ?? false);
                }
                addDiceHero += stsres.addDiceHero ?? 0;
                minusDiceHero += stsres.minusDiceHero ?? 0;
                minusDiceCard += stsres.minusDiceCard ?? 0;
                isInvalid ||= stsres.isInvalid ?? false;
                if (types.includes(1) && (stsres.damage || stsres.pendamage || stsres.heal)) {
                    statusIdsAndPidx.push({
                        id: sts.id, type: group, pidx, isOppo: +!!stsres.isOppo, trigger, hidx,
                        isQuickAction: isQuickAction == 2 || (!!card && !card.subType.includes(7)) || trigger == 'action-start', isSwitchAtk
                    });
                }
                if (isExec) {
                    const stsexecres = stsres.exec?.(undefined, { changeHeroDiceCnt });
                    changeHeroDiceCnt = stsexecres?.changeHeroDiceCnt ?? 0;
                    nost.push(...(stsexecres?.outStatus ?? []));
                    nist.push(...(stsexecres?.inStatus ?? []));
                    nistop.push(...(stsexecres?.inStatusOppo ?? []));
                    nostop.push(...(stsexecres?.outStatusOppo ?? []));
                    const stscmds = [...(stsres.cmds ?? []), ...(stsexecres?.cmds ?? [])];
                    cmds.push(...stscmds);
                    if (intvl && (!types.includes(1) || !sts.type.includes(1)) && !stsres.damage && !stsres.pendamage && !stsres.heal) {
                        const tintvl = clone(intvl);
                        if (stsres.damage || stsres.pendamage) tintvl[2] = 2000;
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
                                    const opponent = this.players[pidx ^ 1];
                                    let aheros: Hero[] = this.players[pidx].heros;
                                    let eheros: Hero[] = opponent.heros;
                                    let asummon: Summonee[] | undefined;
                                    let esummon: Summonee[] | undefined;
                                    let willDamage: number[][] | undefined;
                                    let elTips: [string, number, number][] | undefined;
                                    let isOppo: boolean = stsres.isOppo ?? false;
                                    let aWillAttach: number[][] | undefined;
                                    let aWillHeal: number[] = new Array(aheros.length + eheros.length).fill(-1);
                                    let willAttachs: number[][] | undefined;
                                    let dmgElements: number[] = new Array(eheros.length).fill(0);
                                    const { heros, ndices, willHeals } = this._doCmds(stscmds, { pidx, hidxs: [hidx] });
                                    if (heros) aheros = heros;
                                    if (stsres.damage || stsres.pendamage) {
                                        if (asummon == undefined) asummon = this.players[pidx].summon;
                                        if (esummon == undefined) esummon = opponent.summon;
                                        const eFrontIdx = isOppo ? hidx : eheros.findIndex(h => h.isFront);
                                        const apidx = isOppo ? opponent.pidx : pidx;
                                        const stsreshidxs = stsres.hidxs ?? getBackHidxs(isOppo ? aheros : eheros);
                                        const { willDamage: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, eheros: eheros1,
                                            esummon: esummon1, aheros: aheros1, asummon: asummon1, elrcmds: elrcmds1, elTips: elTips1 }
                                            = this._elementReaction(
                                                stsres.element ?? 0,
                                                new Array((isOppo ? aheros : eheros).length).fill(0).map((_, i) => [
                                                    i == eFrontIdx ? (stsres.damage ?? -1) : -1,
                                                    stsreshidxs.includes(i) ? (stsres.pendamage ?? 0) : 0
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
                                        dmgElements = [...dmgElements1];
                                        aWillAttach = new Array(aheros.length + eheros.length).fill(0).map(() => []);
                                        for (let i = 0; i < 3; ++i) aWillAttach[i + (apidx ^ 1) * 3].push(willAttachs1[i]);
                                        willDamage = [...willDamage1];
                                        stscmds.push(...elrcmds1[0]);
                                        elTips = elTips1;
                                        willAttachs = new Array(aheros.length + eheros.length).fill(0).map(() => []);
                                        willAttachs[eFrontIdx + (pidx ^ +!isOppo) * 3].push(stsres.element ?? 0);
                                    }
                                    if (stsres.heal) {
                                        const stshl = stsres.heal ?? 0;
                                        (stsres.hidxs ?? [isOppo ? eheros.findIndex(h => h.isFront) : hidx]).forEach(hli => {
                                            const hlhidx = hli + 3 * (pidx ^ +!isOppo);
                                            if (aWillHeal[hlhidx] < 0) aWillHeal[hlhidx] = stshl;
                                            else aWillHeal[hlhidx] += stshl;
                                        });
                                    }
                                    const curStatus = (group == 0 ? aheros[hidx].inStatus : aheros[hidx].outStatus).find(s => s.id == sts.id);
                                    if (!curStatus) throw new Error(`[${p.name}]${aheros[hidx].name}:${sts.name} status not found`);
                                    stsres.exec?.(curStatus);
                                    this._doHeal(willHeals ?? aWillHeal, p.heros, { pidx });
                                    this.socket.emit('sendToServer', {
                                        cpidx: pidx,
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
                                        playerInfo: this.players[pidx].playerInfo,
                                        isEndAtk: this.taskQueue.isTaskEmpty(),
                                        step: 1,
                                        flag: `_doStatus-${group == 0 ? 'in' : 'out'}Status-task-${curStatus.name}-${pidx}`,
                                    });
                                },
                                () => { },
                                () => { }
                            ];
                            task = [statusHandle, tintvl];
                        }
                    }
                    if (trigger == 'useReadySkill') {
                        this.canAction = false;
                        readySkill = stsres.skill ?? -1;
                    }
                }
            }
            return { nist, nost, nistop, nostop }
        }
        for (let i = 0; i < pheros.length; ++i) {
            const hidx = (i + p.hidx) % pheros.length;
            let h = pheros[hidx];
            if ((hidxs ?? [hidx]).includes(hidx) && (h.isFront || (!isOnlyOutStatus && !isOnlyFront))) {
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
        if (isExec && !taskMark) this.taskQueue.addStatusAtk(statusIdsAndPidx, isUnshift);
        if (readySkill > -1) setTimeout(() => this.useSkill(readySkill, { isReadySkill: true }), 1200);
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
    _doStatusAtk(stsTask: StatusTask) {
        return new Promise<boolean>(async resolve => {
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
            const getAtkStatus = () => (stype == 0 ? aheros[ahidx].inStatus : aheros[ahidx].outStatus).find(sts => sts.id == sid) ?? heroStatus(sid);
            const atkedIdx = isOppo ? ahidx : eFrontIdx;
            const stsres = heroStatus(sid).handle(getAtkStatus(), {
                heros: aheros,
                eheros,
                trigger,
                hidx: ahidx,
                force: true,
            });
            const stsreshidxs = stsres.hidxs ?? getBackHidxs(isOppo ? aheros : eheros);
            let { willDamage, willAttachs: willAttachs1, dmgElements, eheros: eheros1, esummon, aheros: aheros1, asummon, elrcmds, elTips }
                = this._elementReaction(
                    stsres.element ?? 0,
                    new Array((isOppo ? aheros : eheros).length).fill(0).map((_, i) => [
                        i == atkedIdx ? (stsres.damage ?? -1) : -1,
                        (stsreshidxs.includes(i)) ? (stsres.pendamage ?? 0) : 0
                    ]),
                    atkedIdx,
                    isOppo ? aheros : eheros,
                    isOppo ? aSummon : eSummon,
                    isOppo ? eheros : aheros,
                    isOppo ? eSummon : aSummon,
                    { pidx: pidx ^ isOppo }
                );
            aheros = isOppo ? eheros1 : aheros1;
            eheros = isOppo ? aheros1 : eheros1;
            const { cmds: execmds = [] } = stsres.exec?.(getAtkStatus(), { heros: aheros }) ?? {};
            this.willDamages = [...willDamage];
            const aWillAttach: number[][] = new Array(aheros.length + eheros.length).fill(0).map(() => []);
            for (let i = 0; i < 3; ++i) aWillAttach[i + (pidx ^ 1) * 3].push(willAttachs1[i]);
            let willHeals: number[] | undefined;
            const cmds = [...(stsres.cmds ?? []), ...(execmds ?? [])];
            let dices;
            if (cmds.length > 0) {
                const { willHeals: cmdheal, ndices, heros } = this._doCmds(cmds, { pidx, heros: aheros });
                willHeals = cmdheal;
                dices = ndices;
                if (heros) aheros = heros;
            }
            if (stsres.heal) {
                const heals = new Array(aheros.length).fill(0).map((_, hi) => {
                    return (stsres.hidxs ?? [ahidx]).includes(hi) ? (stsres.heal ?? 0) : -1;
                });
                if (willHeals == undefined) willHeals = new Array(aheros.length + eheros.length).fill(-1);
                for (let i = 0; i < 3; ++i) {
                    if (heals[i] < 0) continue;
                    const hlidx = i + (pidx ^ 1) * 3;
                    if (willHeals[hlidx] < 0) willHeals[hlidx] = 0;
                    willHeals[hlidx] = Math.min(aheros[i].maxhp - aheros[i].hp, willHeals[hlidx] + heals[i]);
                }
            }
            this._doHeal(willHeals, aheros, { pidx });
            let isSwitchAtk = false;
            if (!isOppo && elrcmds[0].some(cmds => cmds.cmd?.includes('switch') && !cmds.cmd?.includes('self'))) {
                const { statusIdsAndPidx: stpidx } = this._doStatus(pidx ^ 1, 1, 'change-from', { hidxs: [eFrontIdx] });
                if (stpidx.length > 0) isSwitchAtk = true;
            }
            const willAttachs: number[][] = new Array(aheros.length + eheros.length).fill(0).map(() => []);
            willAttachs[eFrontIdx + (pidx ^ 1) * 3].push(stsres.element ?? 0);
            this.socket.emit('sendToServer', {
                statusId: [sid, stype, ahidx, isa, isQuickAction],
                cpidx: pidx,
                summonee: isOppo ? esummon : asummon,
                heros: aheros,
                eheros,
                esummon: isOppo ? asummon : esummon,
                willDamage: this.willDamages,
                willAttachs,
                dmgElements,
                elTips,
                willHeals,
                dices,
                cmds: [...elrcmds[0], ...cmds],
                playerInfo: this.players[pidx].playerInfo,
                isEndAtk: this.taskQueue.isTaskEmpty() && !isSwitchAtk && !isa,
                step: 1,
                flag: `_dostatusAtk-${sid}-${pidx}`,
            });
            resolve(true);
        });
    }
    /**
    * 被动技能发动
    * @param hidx 发动技能角色的索引idx
    * @param trigger 触发的时机
    * @param options pidx 玩家idx, players 玩家组, heros 角色组, eheros 敌方角色组, isExec 是否执行, getdmg 受到伤害数, isEffectHero 是否直接作用于改变角色组
    * @returns isQuickAction: 是否为快速行动, heros 变化后的我方角色组, eheros 变化后的对方角色组, isTriggered 是否触发被动
    */
    _doSkill5(hidx: number, otrigger: Trigger | Trigger[],
        options: {
            pidx?: number, players?: Player[], heros?: Hero[], eheros?: Hero[],
            isExec?: boolean, getdmg?: number, isEffectHero?: boolean
        } = {}
    ) {
        if (hidx < 0) return { isQuickAction: false, heros: [], eheros: [], isTriggered: false }
        const { pidx = this.playerIdx, players = this.players, isExec = true, getdmg = 0, isEffectHero = true } = options;
        let { heros = players[pidx].heros, eheros = players[pidx ^ 1].heros } = options;
        let isTriggered = false;
        const hero = heros[hidx];
        let isQuickAction = false;
        const skills = herosTotal(hero.id).skills;
        const skill5s = skills.filter(sk => sk.type == 4);
        const triggers: Trigger[] = [];
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        const cmds: Cmds[] = [];
        for (const skill5 of skill5s) {
            for (const trigger of triggers) {
                const skillres = skill5.handle({ hero, skidx: skills.findIndex(sk => sk.name == skill5.name), getdmg, trigger, heros });
                if (!skillres.trigger?.includes(trigger)) continue;
                isTriggered = true;
                cmds.push(...(skillres.cmds ?? []));
                if (skillres.inStatus) cmds.push({ cmd: 'getInStatus', status: skillres.inStatus, hidxs: [hidx] });
                if (skillres.isQuickAction) isQuickAction = true;
                if (isExec) skillres.exec?.();
            }
        }
        if (hidx == heros.findIndex(h => h.isFront)) {
            for (let i = 0; i < eheros.length; ++i) {
                const ehero = eheros[i];
                if (ehero.hp <= 0) continue;
                const eskills = herosTotal(ehero.id).skills;
                const eskill5s = eskills.filter(sk => sk.type == 4);
                for (const eskill5 of eskill5s) {
                    const skilloppores = eskill5.handle({ hero: ehero, skidx: 5 });
                    for (const trg of triggers) {
                        if (!skilloppores.trigger?.includes(trg)) continue;
                        if (skilloppores.outStatusOppo) cmds.push({ cmd: 'getOutStatus', status: skilloppores.outStatusOppo });
                    }
                }
            }
        }
        const { heros: nh } = this._doCmds(cmds, { pidx, heros, isExec, isEffectHero });
        if (nh) heros = nh;
        return { isQuickAction, heros, eheros, isTriggered }
    }
    /**
     * 检测装备栏
     * @param triggers 触发时机
     * @param options 配置项: isOnlyRead 是否只读, pidx 玩家索引, hidxs 当前角色索引, summons 当前玩家召唤物, changeHeroDiceCnt 切换角色需要骰子,
     *                        heal 回血量, heros 我方角色组, eheros 敌方角色组, hcard 使用的牌, isChargedAtk 是否为重击, isSkill 使用技能的idx, taskMark 任务标记,
     *                        isFallAtk 是否为下落攻击, isExec 是否执行task(配合新heros), intvl 间隔时间, dieChangeBack 是否为死后切换角色, card 可能要装备的卡,
     *                        usedDice 使用的骰子数, ehidx 被攻击角色的idx, minusDiceCard 用卡减骰子, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列,
     *                        getdmg 受到的伤害, isQuickAction 是否为快速攻击, isUnshift 是否立即加入task
     * @returns willHeals 将要回血, pidx 玩家索引, changeHeroDiceCnt 切换角色需要骰子, addDmg 条件加伤, inStatus 新增角色状态, outStatus 新增出战状态
     *          addDmgSummon 召唤物加伤, summon 新出的召唤物, minusDiceSkill 用技能减骰子, isQuickAction 是否为快速攻击
     */
    _doSlot(otriggers: Trigger | Trigger[], options: {
        pidx?: number, hidxs?: number | number[], summons?: Summonee[], ehidx?: number, card?: Card | null, taskMark?: number[],
        changeHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[], minusDiceCard?: number, isUnshift?: boolean,
        hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, isSkill?: number, minusDiceSkill?: number[][],
        isExec?: boolean, intvl?: number[], dieChangeBack?: boolean, usedDice?: number, isQuickAction?: boolean, getdmg?: number[],
    } = {}) {
        const triggers: Trigger[] = [];
        if (typeof otriggers == 'string') triggers.push(otriggers);
        else triggers.push(...otriggers);
        const { pidx = this.playerIdx, summons = this.players[pidx].summon, heal, hcard, ehidx = -1,
            heros = this.players[pidx].heros, eheros = this.players[pidx ^ 1].heros, taskMark, isUnshift = false,
            isChargedAtk = false, isFallAtk = this.isFall, isExec = true, intvl = [0, 0, 0, 0], card,
            dieChangeBack = false, isSkill = -1, usedDice = 0, getdmg } = options;
        let { changeHeroDiceCnt = 0, minusDiceCard = 0, hidxs = [this.players[pidx].hidx], minusDiceSkill, isQuickAction = false } = options;
        const slotIds: [number, Card][][] = [[], [], []];
        let willHeals: number[] = new Array(heros.length).fill(-1);
        let addDmg = 0;
        let addDmgSummon = 0;
        let inStatus: Status[] = [];
        let outStatus: Status[] = [];
        let summon: Summonee[] | undefined;
        let minusDiceHero = 0;
        let task: [(() => void)[], number[]] | undefined;
        const ahidx = this.players[pidx].hidx;
        if (typeof hidxs == 'number') {
            if (hidxs < 0) hidxs = [];
            else hidxs = [hidxs];
        } else {
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        }
        let exwkhidxs: number[] = [];
        for (const hidx of hidxs) {
            if (taskMark && taskMark[0] != hidx) continue;
            const fHero = heros[hidx];
            const slots = [fHero.weaponSlot, fHero.artifactSlot, fHero.talentSlot];
            const cmds: Cmds[][] = [];
            if (card?.type == 0 && slots.every(slot => slot?.id != card.id) && fHero.id == card.userType) slots.push(card);
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
                            hcardsCnt: this.player.handCards.length,
                            dicesCnt: this.player.dice.length - usedDice,
                            isSkill,
                            isExec,
                            minusDiceCard,
                            minusDiceSkill,
                            getdmg,
                        });
                        if (this._hasNotTrigger(slotres.trigger, trigger)) continue;
                        if (isExec) {
                            if (slotres.execmds) {
                                cmds.push(slotres.execmds);
                                slotIds[hidx].push([hidx, slot]);
                            }
                            if (!slotres.execmds?.length || taskMark) {
                                const slotexecres = slotres.exec?.();
                                if (slotexecres?.inStatus) inStatus.push(...slotexecres.inStatus);
                                if (slotexecres?.outStatus) outStatus.push(...slotexecres.outStatus);
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
                        }
                        changeHeroDiceCnt -= slotres.minusDiceHero ?? 0;
                        minusDiceHero += slotres.minusDiceHero ?? 0;
                        minusDiceCard += slotres.minusDiceCard ?? 0;
                        addDmg += slotres.addDmgCdt ?? 0;
                        addDmgSummon += slotres.addDmgSummon ?? 0;
                        minusDiceSkill = slotres.minusDiceSkill ?? minusDiceSkill;
                        if (trigger == 'will-killed' && slot.subType.includes(-4)) exwkhidxs.push(hidx);
                        if (slotres.execmds?.some(cmds => cmds.cmd == 'heal') && !isExec) {
                            const { cnt: heal = -1, hidxs } = slotres.execmds.find(cmds => cmds.cmd == 'heal') ?? {};
                            willHeals.forEach((v, i, a) => {
                                if (hidxs?.includes(i) || (hidxs == undefined && heros[i].isFront)) {
                                    if (v < 0) a[i] = heal;
                                    else a[i] += heal;
                                }
                            });
                        }
                        if (slotres.summon) {
                            if (summon == undefined) summon = [...slotres.summon];
                            else summon.push(...slotres.summon);
                        }
                        if (slotres.inStatus) inStatus.push(...slotres.inStatus)
                        if (slotres.inStatusOppo) {
                            (slotres.hidxs ?? [eheros.findIndex(h => h.isFront)]).forEach(hi => {
                                eheros[hi].inStatus = this._updateStatus(slotres.inStatusOppo ?? [], eheros[hi].inStatus).nstatus;
                            });
                        }
                        if (slotres.outStatus) outStatus.push(...slotres.outStatus);
                        if (slotres.outStatusOppo) {
                            const ehidx = eheros.findIndex(h => h.isFront);
                            eheros[ehidx].outStatus = this._updateStatus(slotres.outStatusOppo ?? [], eheros[ehidx].outStatus).nstatus;
                        }
                    }
                }
            });
            for (let i = 0; i < cmds.length; ++i) {
                if (cmds[i].length == 0) continue;
                if (isExec) {
                    if (!taskMark) {
                        const args = Array.from(arguments);
                        args[1] = clone(args[1]) ?? {};
                        args[1].pidx = pidx;
                        args[1].taskMark = [hidx, slotIds[hidx][i][1].subType[0]];
                        this.taskQueue.addTask('slot-' + slotIds[hidx][i][1].name, args, isUnshift);
                    } else {
                        const slotHandle = [
                            () => { },
                            (isEndAtk = false) => {
                                let nheros: Hero[] | undefined;
                                let dices: { val: number[], isDone: boolean } | undefined;
                                const isOnlyEffect = cmds[i][0].cmd == '';
                                if (!isOnlyEffect) {
                                    nheros = this.players[pidx].heros;
                                    const { ndices: nd, heros: nh, inStatus: nist, willHeals } = this._doCmds(cmds[i], { pidx, heros: nheros });
                                    dices = nd;
                                    if (nh) nheros = nh;
                                    if (nist) nheros[hidx].inStatus = nist[hidx];
                                    if (inStatus) {
                                        nheros[hidx].inStatus = this._updateStatus(inStatus, nheros[hidx].inStatus).nstatus;
                                    }
                                    if (outStatus) {
                                        nheros[hidx].outStatus = this._updateStatus(outStatus, nheros[hidx].outStatus).nstatus;
                                    }
                                    this._doHeal(willHeals, nheros, { pidx, isQuickAction });
                                }
                                this.socket.emit('sendToServer', {
                                    cpidx: pidx,
                                    slotres: { cmds: cmds[i], slotIds: slotIds[hidx][i] },
                                    heros: nheros,
                                    eheros: this.players[pidx ^ 1].heros,
                                    dices,
                                    hidx,
                                    isEndAtk: isEndAtk && !dieChangeBack,
                                    isQuickAction,
                                    step: 1,
                                    flag: `_doSlot-${slotIds[hidx][i][1].name}-${pidx}`,
                                });
                            },
                            () => { },
                            () => { },
                        ];
                        task = [slotHandle, intvl];
                    }
                }
            }
        }
        return {
            willHeals, pidx, changeHeroDiceCnt, addDmg, addDmgSummon, inStatus: isCdt(inStatus.length > 0, inStatus), nwkhidxs: hidxs.filter(hi => !exwkhidxs.includes(hi)),
            outStatus: isCdt(outStatus.length > 0, outStatus), minusDiceHero, summon, isQuickAction, minusDiceCard, minusDiceSkill, task,
        };
    }
    /**
     * 检测回血
     * @param willHeal 回血量
     * @param heros 回血角色组
     * @param options pidx 玩家idx, isQuickAction 是否为快速行动, isExec 是否执行
     */
    _doHeal(willHeal: number[] | undefined, heros: Hero[], options: { pidx?: number, isExec?: boolean, isQuickAction?: boolean } = {}) {
        const { isExec = true, isQuickAction, pidx = this.playerIdx } = options;
        const heal = willHeal?.slice(3 - pidx * 3, 6 - pidx * 3).map(v => Math.max(0, v) % 100);
        if (heal?.some(hl => hl > 0)) {
            this._doSlot('heal', { pidx, hidxs: allHidxs(heros, { isAll: true }), heal, heros, isExec, isQuickAction });
            this._doStatus(pidx, 4, 'heal', { heal, isExec });
            const { siteCnt } = this._doSite(pidx, 'heal', { heal, isExec, isQuickAction });
            this._doSite(pidx ^ 1, 'eheal', { heal, isExec, isQuickAction });
            if (!isExec) this.siteCnt[pidx].forEach((_, i, a) => a[i] += siteCnt[pidx][i]);
        }
    }
    /**
     * 执行命令集
     * @param cmds 命令集
     * @param options isCard 是否为使用卡, hidxs 角色索引组, pidx 执行命令玩家idx, heal 回血量, isExec 是否执行, heros 角色组, eheros 敌方角色组,
     *                ahidx 攻击角色hidx, ehidx 受击角色hidx, isEffectHero 是否直接作用于改变角色组
     * @returns ndices 骰子, phase 阶段, heros 角色组, eheros 敌方角色组, inStatus 获得角色状态, willHeals 回血组, changedEl 变化元素
     */
    _doCmds(cmds?: Cmds[],
        options: {
            isCard?: boolean, hidxs?: number[], pidx?: number, heal?: number,
            isExec?: boolean, heros?: Hero[], eheros?: Hero[], ahidx?: number, ehidx?: number, isEffectHero?: boolean
        } = {}
    ) {
        const { isCard = false, hidxs: chidxs, pidx = this.playerIdx, heal = 0,
            isExec = true, heros: ocheros, eheros: oceheros, isEffectHero = false } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const cheros = ocheros ?? player.heros;
        const ceheros = oceheros ?? opponent.heros;
        const { ahidx = player.hidx, ehidx = opponent.hidx } = options;
        const dices = player.dice.filter((_, i) => !isExec || !player.diceSelect[i]).map(v => ({ val: v, isSelected: false }));
        let ndices = this.rollDice(dices, { pidx, frontIdx: player.hidx });
        if (cmds == undefined || cmds.length == 0) return { ndices };
        let isSwitch: number = cheros.findIndex(h => h.isSelected > 0);
        let isSwitchOppo: number = -1;
        let phase: number | undefined;
        let heros: Hero[] | undefined;
        let eheros: Hero[] | undefined;
        let inStatus: Status[][] | undefined;
        let outStatus: Status[] | undefined;
        let inStatusOppo: Status[][] | undefined;
        let outStatusOppo: Status[] | undefined;
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
                this.useSkill(cnt, { isOnlyRead: !isExec, isCard, isSwitch, isReadySkill });
            } else if (cmd.startsWith('switch-')) {
                if (isSwitch == -1) isSwitch = hidxs?.[0] ?? -1;
                if (!isExec) {
                    this.willSwitch = new Array(cheros.length + ceheros.length).fill(false);
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
                    this.willSwitch[cpidx * ceheros.length + nhidx] = true;
                    if (!cmd.endsWith('self')) isSwitchOppo = nhidx;
                    else if (isSwitch == -1) isSwitch = nhidx;
                    else if (!cmds.some(cmds => cmds.cmd == 'useSkill')) this.useSkill(-1, { isOnlyRead: true, otriggers: 'change-from' });
                }
            } else if (['getCard', 'addCard'].includes(cmd)) {
                if (card) {
                    const cards = Array.isArray(card) ? card : new Array(cnt).fill(0).map(() => clone(card));
                    cmds[i].card = cards.map(c => typeof c == 'number' ? cardsTotal(c) : c);
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
                if (getstatus.length == 0 && !isEffectHero) continue;
                if (!inStatus) inStatus = new Array(cheros.length).fill(0).map(() => []);
                (hidxs ?? [ahidx]).forEach(fhidx => {
                    const fhero = (heros ?? cheros)[fhidx];
                    const { nstatus, nheros } = this._updateStatus(getstatus, fhero.inStatus, heros ?? cheros, fhidx);
                    inStatus?.[fhidx].push(...nstatus);
                    if (nheros) heros = nheros;
                    if (heros) {
                        heros[fhidx].inStatus = [...nstatus];
                        if (isEffectHero) {
                            cheros.length = 0;
                            cheros.push(...heros);
                        }
                    }
                });
            } else if (cmd == 'getOutStatus') {
                if (getstatus.length == 0 && !isEffectHero) continue;
                if (!outStatus) outStatus = [];
                const fhero = (heros ?? cheros)[ahidx];
                const { nstatus, nheros } = this._updateStatus(getstatus, fhero.outStatus, heros ?? cheros, ahidx);
                outStatus.push(...nstatus);
                if (nheros) heros = nheros;
                if (heros) {
                    heros[ahidx].outStatus = [...nstatus];
                    if (isEffectHero) {
                        cheros.length = 0;
                        cheros.push(...heros);
                    }
                }
            } else if (cmd == 'getInStatusOppo') {
                if (getstatus.length == 0 && !isEffectHero) continue;
                if (!inStatusOppo) inStatusOppo = new Array(ceheros.length).fill(0).map(() => []);
                (hidxs ?? [ehidx]).forEach(fhidx => {
                    const fhero = (eheros ?? ceheros)[fhidx];
                    const { nstatus, nheros } = this._updateStatus(getstatus, fhero.inStatus, eheros ?? ceheros, fhidx);
                    inStatusOppo?.[fhidx].push(...nstatus);
                    if (nheros) eheros = nheros;
                    if (eheros) {
                        eheros[fhidx].inStatus = [...nstatus];
                        if (isEffectHero) {
                            ceheros.length = 0;
                            ceheros.push(...eheros);
                        }
                    }
                });
            } else if (cmd == 'getOutStatusOppo') {
                if (getstatus.length == 0 && !isEffectHero) continue;
                if (!outStatusOppo) outStatusOppo = [];
                const fhidx = opponent.hidx;
                const fhero = (eheros ?? ceheros)[fhidx];
                const { nstatus, nheros } = this._updateStatus(getstatus, fhero.outStatus, eheros ?? ceheros, fhidx);
                outStatusOppo.push(...nstatus);
                if (nheros) eheros = nheros;
                if (eheros) {
                    eheros[fhidx].outStatus = [...nstatus];
                    if (isEffectHero) {
                        ceheros.length = 0;
                        ceheros.push(...eheros);
                    }
                }
            } else if (['heal', 'revive'].includes(cmd)) {
                const willHeals1 = new Array(cheros.length).fill(0).map((_, hi) => {
                    return (hidxs ?? [player.hidx]).includes(hi) ? (cnt || heal) : -1;
                });
                if (player.pidx == 1) willHeals = [...willHeals1, ...new Array(ceheros.length).fill(-1)];
                else willHeals = [...new Array(ceheros.length).fill(-1), ...willHeals1];
                if (cnt == 0) cmds[i].cnt = heal;
                (cmds[i].hidxs ?? []).forEach(hidx => {
                    const { heros: sk5h } = this._doSkill5(hidx, 'revive', { pidx, heros: heros ?? cheros, isEffectHero: false });
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
        return { cmds, ndices, phase, heros, eheros, inStatus, outStatus, willHeals, changedEl, isSwitch, isSwitchOppo, inStatusOppo, outStatusOppo }
    }
    /**
    * 计算变化的伤害和骰子消耗
    * @param pidx 玩家识别符: 0对方 1我方
    * @param hidx 角色索引idx
    * @param options isUpdateHandcards 是否更新手牌, isSwitch 是否为切换角色, isReadySkill 准备技能rdskidx
    */
    _calcSkillChange(pidx: number, hidx: number, options: { isUpdateHandcards?: boolean, isSwitch?: boolean, isReadySkill?: number } = {}) {
        const plidx = this.playerIdx ^ pidx ^ 1;
        const { isUpdateHandcards = true, isSwitch = false, isReadySkill = -1 } = options;
        const heros: Hero[] = (!isSwitch ? this.players[plidx] : clone(this.players[plidx])).heros;
        if (isSwitch) this._doSkill5(hidx, 'change-to', { heros });
        const curHero = heros[hidx];
        if (!curHero) return this.wrap(this.players[plidx], { isUpdateHandcards });
        const rdskill = isReadySkill > -1 ? readySkill(isReadySkill) : null;
        const dmgChange = curHero.skills.filter(sk => sk.type < 4).map(() => 0);
        const costChange = curHero.skills.filter(sk => sk.type < 4).map(() => new Array(2).fill(0));
        let mds: number[][] = [];
        for (const curSkill of curHero.skills) {
            if (curSkill.type == 4) break;
            mds.push(curSkill.cost.slice(0, 2).map(v => v.val));
        }
        const calcDmgChange = (res: any) => {
            if (rdskill) dmgChange[0] += (res?.addDmg ?? 0) + (res?.[`addDmgType${rdskill.type}`] ?? 0);
            else {
                dmgChange.forEach((_, i, a) => {
                    const curSkill = curHero.skills[i];
                    a[i] += (res?.addDmg ?? 0) + (res?.[`addDmgType${curSkill.type}`] ?? 0);
                });
            }
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
        [curHero.inStatus, (isSwitch ? heros.find(h => h.isFront) : curHero)?.outStatus].forEach(stses => {
            stses?.forEach(sts => {
                const stsres = heroStatus(sts.id).handle(sts, {
                    heros,
                    eheros: this.players[plidx ^ 1].heros,
                    hidx,
                    isChargedAtk: (this.player.dice.length & 1) == 0,
                    minusDiceSkill: mds,
                    trigger: 'calc',
                });
                calcDmgChange(stsres);
                calcCostChange(stsres);
            });
        });
        this.players[plidx].summon.forEach(smn => {
            const smnres = newSummonee(smn.id).handle(smn, {
                heros,
                hidx,
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
        if (rdskill) {
            rdskill.dmgChange = dmgChange[0];
            return rdskill;
        }
        for (let i = 0; i < curHero.skills.length; ++i) {
            const curSkill = curHero.skills[i];
            if (curSkill.type == 4) continue;
            curSkill.costChange = [...costChange[i]];
            curSkill.dmgChange = dmgChange[i];
        }
        return this.wrap(this.players[plidx], { isUpdateHandcards, hero: isCdt(isSwitch, heros[hidx]) });
    }
    /**
     * 计算卡牌的变化骰子消耗
     */
    _clacCardChange() {
        const costChange = this.handCards.map(() => 0);
        const player = this.player;
        const curHero = this._getFrontHero();
        if (!curHero) return;
        this.handCards.forEach((c, ci) => {
            player.heros.forEach(h => {
                [h.artifactSlot, h.weaponSlot].forEach(slot => {
                    if (slot != null) {
                        costChange[ci] += cardsTotal(slot.id).handle(slot, {
                            heros: [h],
                            hidxs: [0],
                            hcard: c,
                            minusDiceCard: costChange[ci],
                        })?.minusDiceCard ?? 0;
                    }
                });
            });
            [...player.heros.map(h => h.inStatus), curHero.outStatus].forEach((stses, hi) => {
                stses.forEach(sts => {
                    costChange[ci] += heroStatus(sts.id).handle(sts, {
                        heros: player.heros,
                        hidx: hi < player.heros.length ? hi : player.hidx,
                        card: c,
                        minusDiceCard: costChange[ci],
                    })?.minusDiceCard ?? 0;
                });
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
        minusDiceHero += this._doSlot(['change', 'change-from'], { isExec: false }).minusDiceHero;
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
                await this._wait(() => this.actionInfo == '', { delay: 0, freq: 200, isImmediate: false });
                // if (this.taskQueue.isTaskEmpty()) break;
                const [taskType, args] = this.taskQueue.getTask();
                if (taskType == undefined || args == undefined) break;
                let task: [(() => void)[], number[]] | undefined;
                if (isDieChangeBack && !taskType.includes('statusAtk-')) await this._delay(2300);
                if (taskType.startsWith('status-')) task = this._doStatus(...(args as Parameters<typeof this._doStatus>)).task;
                else if (taskType.startsWith('site-')) task = this._doSite(...(args as Parameters<typeof this._doSite>)).task;
                else if (taskType.startsWith('summon-')) task = this._doSummon(...(args as Parameters<typeof this._doSummon>)).task;
                else if (taskType.startsWith('slot-')) task = this._doSlot(...(args as Parameters<typeof this._doSlot>)).task;
                if (taskType.startsWith('statusAtk-')) {
                    const isExeced = await this._doStatusAtk(args as StatusTask);
                    if (!isExeced) {
                        this.taskQueue.addStatusAtk([args as StatusTask], true);
                        break;
                    }
                    await this._delay(500);
                } else await this.taskQueue.execTask(...(task ?? [[], []]));
                if (isDieChangeBack) isDieChangeBack = false;
                if (isWait) {
                    if (!this._hasNotDieChange()) isDieChangeBack = true;
                    await this._wait(() => this._hasNotDieChange(), { delay: 0, maxtime: 1e9 });
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
     * 开启倒计时
     */
    _startTimer(curr?: number) {
        if (this.countdown.limit <= 0) return;
        if (this.countdown.timer != null) clearInterval(this.countdown.timer);
        this.countdown.curr = curr || this.countdown.limit;
        this.countdown.timer = setInterval(() => {
            --this.countdown.curr;
            if (this.countdown.curr <= 0 || this.phase != PHASE.ACTION) {
                if (this.countdown.curr <= 0 && this.player.status == 1) this.endPhase();
                this.countdown.curr = 0;
                if (this.countdown.timer != null) clearInterval(this.countdown.timer);
                this.countdown.timer = null;
            }
        }, 1000);
    }
    /**
     * 延迟函数
     * @param time 延迟时间
     */
    _delay(time = 0) {
        if (time == 0) return;
        return new Promise<void>(resolve => {
            setTimeout(resolve, time);
        });
    }
    /**
     * 同步等待
     * @param cdt 跳出等待的条件
     * @param options.delay 跳出等待后的延迟(=2000)
     * @param options.freq 判断的频率(=500)
     * @param options.recnt 判断的次数(=50)
     * @param options.isImmediate 是否立即跳出(=true)
     */
    async _wait(cdt: () => boolean, options: { delay?: number, freq?: number, maxtime?: number, isImmediate?: boolean } = {}) {
        const { delay = 2000, freq = 500, maxtime = 8000, isImmediate = true } = options;
        let loop = 0;
        if (cdt() && isImmediate) return;
        while (true) {
            ++loop;
            await this._delay(freq);
            if (cdt()) {
                await this._delay(delay);
                break;
            }
            if (loop > maxtime / freq) throw new Error('too many loops: ' + cdt.toString());
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
        if (this.queue.some(([tpn]) => tpn == taskType)) return;
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
        // const [res] = this.queue;
        if (res[0].startsWith('statusAtk-')) --this.statusAtk;
        this._emit(`getTask:${res[0]}(queue=[${this.queue.map(v => v[0])}])`);
        return res;
    }
    isTaskEmpty() {
        return this.queue.length == 0;
    }
    addStatusAtk(ststask: StatusTask[], isUnshift = false) {
        if (ststask.length == 0) return;
        for (const t of ststask) {
            const atkname = 'statusAtk-' + heroStatus(t.id).name;
            if (this.queue.some(([tpn]) => tpn == atkname)) continue;
            if (isUnshift) this.queue.unshift([atkname, t]);
            else this.queue.push([atkname, t]);
            ++this.statusAtk;
        }
        this._emit(`${isUnshift ? 'unshift' : 'add'}StatusAtk(queue=[${this.queue.map(v => v[0])}])`);
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


const NULL_CARD: Card = { ...cardsTotal(0) };

const NULL_PLAYER: Player = {
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
    status: 0,
    phase: 0,
    info: '',
    willGetCard: [],
    willAddCard: [],
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

const NULL_MODAL: InfoVO = { isShow: false, type: -1, info: null };

const NULL_SKILL: Skill = herosTotal(0).skills[0];

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