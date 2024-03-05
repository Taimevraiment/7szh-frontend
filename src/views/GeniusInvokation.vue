<template>
    <div class="container" :class="{ 'mobile-container': isMobile }" @click.stop="cancel">

        <button class="exit" @click="exit">返回</button>
        <div class="player-info">{{ players[playerIdx]?.info }}</div>
        <span style="margin-left: 50px;">&nbsp;七圣召唤</span>
        <button v-if="isLookon == -1 && phase < 2" class="start" @click="startGame">
            {{ players[playerIdx]?.phase == 0 ? '准备开始' : '取消准备' }}
        </button>
        <button v-if="isLookon == -1 && players[playerIdx]?.phase == 0" class="deck-open" @click="enterEditDeck">
            查看卡组
        </button>

        <div :class="{
        'player-display': true,
        'curr-player': players[playerIdx]?.status == 1 && phase < 7 && phase > 2 && isWin == -1,
        'mobile-player-display': isMobile
    }" @click.stop="devOps()">
            <span v-if="isLookon > -1">旁观中......</span>
            <p>{{ players[playerIdx]?.name }}</p>
            <div v-if="isWin > -1 || isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
                {{ player?.handCards?.length ?? 0 }}
            </div>
            <img class="subtype8" :src="getDiceIcon('subtype8-empty')">
            <img v-if="player && !player.isUsedSubType8" class="subtype8" :src="getDiceIcon('subtype8')">
        </div>

        <div v-if="opponent" :class="{
        'player-display-oppo': true,
        'curr-player': opponent?.status == 1 && phase < 7 && phase > 2 && isWin == -1,
        'mobile-player-display': isMobile
    }">
            <p>{{ opponent?.name }}</p>
            <div v-if="isWin > -1 || isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
                {{ opponent?.handCards?.length ?? 0 }}
            </div>
            <img v-if="opponent?.isOffline" src="@/assets/svg/offline.svg" class="offline" alt="断线...">
            <img v-if="isLookon > -1" src="@/assets/svg/lookon.svg" class="lookon" alt="旁观"
                @click="lookonTo(opponent?.pidx ?? -1)">
            <img class="subtype8-oppo" :src="getDiceIcon('subtype8-empty')">
            <img v-if="opponent && !opponent.isUsedSubType8" class="subtype8-oppo" :src="getDiceIcon('subtype8')">
        </div>

        <main-desk v-if="phase > 1 || isWin > -1" :players="players" :phase="phase" :playerIdx="playerIdx"
            :currCard="currCard" :currSkill="currSkill" :isMobile="isMobile" :diceSelect="diceSelect"
            :showRerollBtn="showRerollBtn" :rollCnt="rollCnt" :isReconcile="isReconcile" :willAttachs="willAttachs"
            :willDamages="willDamages" :willHeals="willHeals" :isShowChangeHero="isShowChangeHero"
            :isShowDmg="isShowDmg" :willSummons="willSummons" :canAction="canAction" :isShowHeal="isShowHeal"
            :elTips="elTips" :willHp="willHp" :dmgElements="dmgElements" :heroChangeDice="heroChangeDice"
            :siteCnt="siteCnt" :summonCnt="summonCnt" :afterWinHeros="afterWinHeros" :willSwitch="willSwitch"
            :isLookon="isLookon" :isWin="isWin" @select-change-card="selectChangeCard" @change-card="changeCard"
            @choose-hero="chooseHero" @reroll="reroll" @select-hero="selectHero" @select-use-dice="selectUseDice"
            @select-site="selectCardSite" @select-summon="selectCardSummon" @end-phase="endPhase" />

        <div v-if="(player?.phase ?? 0) > 2 || isWin > -1" class="hand-card" :class="{ 'mobile-hand-card': isMobile }"
            :style="{ transform: `translateX(-${24 * handCards.length / 2}px)` }">
            <div v-for="(card, idx) in handCards" :key="idx * 1000 + (card?.id ?? 0) + 'myhandcard'" class="card"
                :class="{ 'selected': card.selected, 'mobile-card': isMobile }" :style="{ left: `${card.pos}px` }"
                @click.stop="selectCard(idx)" @mouseenter="mouseenter(idx)" @mouseleave="mouseleave(idx)">
                <img class="card-img" :src="card.src" v-if="card?.src?.length > 0" :alt="card.name" />
                <img class="subtype8-border" v-if="card.subType.includes(8)" :src="getPngIcon('subtype8-border')" />
                <div class="card-content">
                    <span v-if="card?.src?.length == 0">{{ card.name }}</span>
                    <div class="card-cost" :style="{ color: card.costChange > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                        <img class="cost-img hcard" :src="getDiceIcon(ELEMENT_ICON[card.costType])" />
                        <span>{{ Math.max(0, card.cost - card.costChange) }}</span>
                    </div>
                    <div class="card-energy" v-if="card.anydice > 0">
                        <img class="cost-img hcard" :src="getDiceIcon(ELEMENT_ICON[0])" />
                        <span>{{ card.anydice }}</span>
                    </div>
                    <div class="card-energy" v-if="card.energy > 0">
                        <img class="cost-img hcard" :src="getDiceIcon(ELEMENT_ICON[9])" />
                        <span>{{ card.energy }}</span>
                    </div>
                    <div class="card-energy" v-if="card.subType.includes(8)">
                        <img class="cost-img hcard" :src="getDiceIcon(ELEMENT_ICON[10])" />
                    </div>
                </div>
            </div>
        </div>

        <div class="btn-group"
            v-if="isLookon == -1 && (player.status == 1 && canAction || player.phase >= 9) && player.phase > 4 && (currCard.id > 0 || isShowChangeHero > 0) || player.phase == 3">
            <button :class="{ forbidden: !isValid }" v-if="!isReconcile && currCard.id > 0 && canAction"
                @click.stop="useCard">出牌</button>
            <button v-if="currCard.id > 0 && canAction" @click.stop="reconcile(true)"
                :style="{ backgroundColor: ELEMENT_COLOR[player.heros.find(v => v.isFront)?.element ?? 0] }"
                :class="{ forbidden: player.dice.every(v => [0, player.heros[player.hidx].element].includes(v)) }">
                调和
            </button>
            <button v-if="isReconcile && currCard.id > 0" @click.stop="reconcile(false)">取消</button>
            <div v-if="isShowChangeHero > 0 && currCard.id <= 0 || player.phase == 3 && player.heros.some(h => h.isSelected > 0)"
                style="display: flex;flex-direction: column;align-items: center;">
                <div class="quick-action" v-if="isShowChangeHero == 3">快速行动</div>
                <button :class="{ forbidden: !isValid && player.phase != 3 }" v-if="isShowChangeHero < 2"
                    @click.stop="chooseHero">
                    {{ player.phase == 3 || player.phase > 8 ? '出战' : '切换' }}
                </button>
                <button v-else :class="{ forbidden: !isValid && player.phase != 3 }"
                    @click.stop="changeHero">确定</button>
                <div class="skill-cost" v-if="player.phase == 6"
                    :style="{ marginTop: '10px', opacity: isShowChangeHero >= 2 ? 1 : 0 }">
                    <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[0])">
                    <span :style="{
        zIndex: 1,
        color: heroChangeDice > 1 ? CHANGE_BAD_COLOR : heroChangeDice < 1 ? CHANGE_GOOD_COLOR : 'white'
    }">
                        {{ heroChangeDice }}
                    </span>
                </div>
            </div>
        </div>
        <div class="skills" v-else-if="phase > 4 && player && player.phase > 4 && player.heros[player.hidx].hp > 0">
            <div class="skill" v-for="(skill, sidx) in skills.filter(sk => sk.type < 4) " :key="sidx">
                <div class="skill-btn" @click.stop="useSkill(sidx, false)"
                    :style="{ boxShadow: skill.type == 3 && player.heros[player.hidx].energy >= skill.energyCost ? `0px 0px 8px 3px ${ELEMENT_COLOR[skill.dmgElement]}` : '' }">
                    <div class="skill3-bg" v-if="skill.type == 3 && player.heros[player.hidx].energy < skill.energyCost"
                        :style="{
        background: `linear-gradient(to top, ${ELEMENT_COLOR[skill.dmgElement]} 0%, ${ELEMENT_COLOR[skill.dmgElement]} ${player.heros[player.hidx].energy / skill.energyCost * 100}%, transparent ${player.heros[player.hidx].energy / skill.energyCost * 100}%, transparent 100%)`
    }">
                        <div class="skill-btn" style="transform: translate(1px,1px);"></div>
                    </div>
                    <img class="skill-img" :src="skill.src" v-if="skill.src.length > 0"
                        :alt="SKILL_TYPE_ABBR[skill.type]">
                    <span v-else>{{ SKILL_TYPE_ABBR[skill.type] }}</span>
                </div>
                <div class="skill-cost" v-for="( cost, cidx ) in skill.cost.filter(c => c.val > 0) " :key="cidx" :style="{
        color: cidx < 2 && skill.costChange[cidx] > 0 ? CHANGE_GOOD_COLOR : 'white'
    }">
                    <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[cost.color])">
                    <span style="z-index: 1;">{{ Math.max(cost.val - (cidx < 2 ? skill.costChange[cidx] : 0), 0) }}
                            </span>
                </div>
                <div class="skill-forbidden" v-if="isLookon > -1 || skill.isForbidden || player.status == 0 || !canAction || phase > 6 ||
        (player.heros.find(h => h.isFront)?.inStatus?.findIndex(s => s.type.includes(14)) ?? -1) > -1
        " @click.stop="useSkill(sidx, true)">
                </div>
            </div>
        </div>
    </div>

    <info-modal v-if="phase > 1" :info="modalInfo" :isMobile="isMobile" @cancel="cancel()" style="z-index: 10;" />

    <h1 v-if="isWin > 1 && players[isWin % 2]?.name" class="win-banner" :class="{ 'mobile-win-banner': isMobile }">
        {{ players[isWin % 2]?.name }}获胜！！！
    </h1>

    <div class="tip" :class="{
        'tip-enter': tip.content != '',
        'tip-leave': tip.content == ''
    }
        " :style="{ top: tip?.top ?? '40%', color: tip?.color ?? 'black' }">
        {{ tip.content }}
    </div>

    <div class="modal-action" :class="{
        'modal-action-my': player.status == 1,
        'modal-action-oppo': opponent?.status == 1,
        'modal-action-enter-my': player.status == 1 && actionInfo != '',
        'modal-action-enter-oppo': opponent?.status == 1 && actionInfo != '',
        'modal-action-leave': actionInfo == ''
    }
        ">
        {{ actionInfo }}
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Socket } from "socket.io-client";


import InfoModal from '@/components/InfoModal.vue';
import MainDesk from '@/components/MainDesk.vue';
import GeniusInvokationClient from '@/geniusInovakationClient';
import { ELEMENT_COLOR, SKILL_TYPE_ABBR, CHANGE_GOOD_COLOR, ELEMENT_ICON, CHANGE_BAD_COLOR } from '@/data/constant';
import { cardTotal } from '@/data/cards';
import { getSocket } from '@/store/socket';

const router = useRouter();
const route = useRoute();

const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const env = process.env.NODE_ENV;
const isDev = env == 'development';
const socket: Socket = getSocket(isDev);

const players = ref<Player[]>([]); // 所有玩家信息数组
const userid = Number(localStorage.getItem('7szh_userid') || '-1'); // 玩家id
const roomId = route.params.roomId; // 房间id
let client = new GeniusInvokationClient(socket, userid, players.value, isMobile.value,
    JSON.parse(localStorage.getItem('GIdecks') ?? '[]'), Number(localStorage.getItem('GIdeckIdx')));

const player = ref<Player>({ ...client.NULL_PLAYER }); // 本玩家
const opponent = ref<Player>(); // 对手玩家
const isStart = ref<boolean>(false); // 是否开始游戏
const phase = ref<number>(0); // 阶段
const handCards = ref<Card[]>([]); // 手牌
const skills = ref<Skill[]>([]); // 技能栏
const currCard = ref<Card>({ ...client.NULL_CARD }); // 当前选择的卡
const currSkill = ref<Skill>({ ...client.NULL_SKILL }); // 当前选择的技能
const isValid = ref<boolean>(false); // 牌型是否合法
const diceSelect = ref<boolean[]>([]); // 骰子选择数组
const showRerollBtn = ref<boolean>(true); // 是否显示重投按钮
const rollCnt = ref<number>(1); // 可重投的次数
const isReconcile = ref<boolean>(false); // 是否进入调和模式
const willAttachs = ref<number[][]>([[], [], [], [], [], []]); // 将要附着的元素
const willDamages = ref<number[][]>([[-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0]]); // 将要受到的伤害
const dmgElements = ref<number[]>([0, 0, 0]); // 造成伤害元素
const willHeals = ref<number[]>([0, 0, 0, 0, 0, 0]); // 回血量
const willHp = ref<(number | undefined)[]>([0, 0, 0, 0, 0, 0]); // 总共的血量变化
const elTips = ref<[string, number, number][]>([['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0], ['', 0, 0]]); // 元素反应提示
const willSummons = ref<Summonee[][]>([[], []]); // 将要召唤的召唤物
const willSwitch = ref<boolean[]>([false, false, false, false, false, false]); // 是否将要切换角色
const siteCnt = ref<number[][]>([[0, 0, 0, 0], [0, 0, 0, 0]]); // 支援物变化数
const summonCnt = ref<number[][]>([[0, 0, 0, 0], [0, 0, 0, 0]]); // 支援物变化数
const isShowDmg = ref<boolean>(false); // 是否显示伤害数
const isShowHeal = ref<boolean>(false); // 是否显示回血数
const isShowChangeHero = ref<number>(0); // 是否显示切换角色按钮
const heroChangeDice = ref<number>(1); // 切换角色消耗的骰子数
const modalInfo = ref<InfoVO>({ ...client.NULL_MODAL }); // 展示信息
const tip = ref<TipVO>({ content: '' }); // 提示信息
const actionInfo = ref<string>(''); // 行动信息
const canAction = ref<boolean>(false); // 是否可以操作
const isWin = ref<number>(-1); // 胜者idx
const afterWinHeros = ref<Hero[][]>([]); // 游戏结束后显示的角色信息
const isLookon = ref<number>(history.state.isLookon ? Math.floor(Math.random() * players.value.length) : -1); // 是否旁观
let playerIdx: number = history.state.isLookon ? -1 : client.playerIdx; // 该玩家序号

setTimeout(() => lookonTo(isLookon.value), 1000);

// 获取骰子背景
const getDiceIcon = (name: string) => {
    return new URL(`@/assets/image/${name}-dice-bg.png`, import.meta.url).href;
}

// 获取png图片
const getPngIcon = (name: string) => {
    if (name.startsWith('http')) return name;
    return new URL(`@/assets/image/${name}.png`, import.meta.url).href;
}

// 防抖函数
const debounce = (fn: (...args: any[]) => any, wait: number = 100) => {
    let timer: NodeJS.Timeout | undefined;
    return (...args: any[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = undefined;
        }, wait);
    }
}

const updateInfo = () => {
    players.value = [...client.players];
    playerIdx = client.playerIdx;
    player.value = { ...client.player };
    opponent.value = { ...client.opponent };
    isStart.value = client.isStart;
    phase.value = client.phase;
    diceSelect.value = [...(client.player?.diceSelect ?? [])];
    showRerollBtn.value = client.showRerollBtn;
    rollCnt.value = client.rollCnt;
    isReconcile.value = client.isReconcile;
    willAttachs.value = [...client.willAttachs];
    willDamages.value = [...client.willDamages];
    dmgElements.value = [...client.dmgElements];
    willHeals.value = [...client.willHeals];
    willHp.value = [...client.willHp];
    elTips.value = [...client.elTips];
    willSummons.value = [...client.willSummons];
    willSwitch.value = [...client.willSwitch];
    siteCnt.value = [...client.siteCnt];
    summonCnt.value = [...client.summonCnt];
    isShowDmg.value = client.isShowDmg;
    isShowHeal.value = client.isShowHeal;
    isShowChangeHero.value = client.isShowChangeHero;
    heroChangeDice.value = client.heroChangeDice;
    modalInfo.value = client.modalInfo;
    tip.value = { ...client.tip };
    actionInfo.value = client.actionInfo;
    handCards.value = [...client.handCards];
    skills.value = [...client.skills];
    currCard.value = { ...client.currCard };
    currSkill.value = { ...client.currSkill };
    isValid.value = client.isValid;
    canAction.value = client.canAction && client.tip.content == '' && client.actionInfo == '';
    isWin.value = client.isWin;
    if (client.isWin < 2) afterWinHeros.value = client.players.map(p => p.heros);
}

// 鼠标放入
const mouseenter = (idx: number) => {
    client.mouseenter(idx);
    updateInfo();
}
// 鼠标离开
const mouseleave = (idx: number) => {
    client.mouseleave(idx);
    updateInfo();
}
// 取消选择
const cancel = () => {
    if (player.value.phase < 2) return;
    client.cancel();
    updateInfo();
}
// 选择要换的卡牌
const selectChangeCard = (idx: number) => {
    client.selectChangeCard(idx);
    updateInfo();
}
// 选择卡牌
const selectCard = (idx: number) => {
    if (isLookon.value > -1 || phase.value < 2) return;
    client.selectCard(idx, updateInfo);
    updateInfo();
}
// 开始游戏
const startGame = () => {
    client.startGame();
    updateInfo();
}
// 查看卡组
const enterEditDeck = () => {
    router.push({ name: 'editDeck' });
}
// 返回
const exit = () => {
    socket.emit('exitRoom');
    router.back();
}
// 换卡
const changeCard = (cidxs: number[]) => {
    client.changeCard(cidxs);
    updateInfo();
}
// 选择出战角色
const chooseHero = () => {
    client.chooseHero();
    updateInfo();
}
// 重掷骰子
const reroll = (dices: DiceVO[]) => {
    client.reroll(dices);
    updateInfo();
}
// 选择角色
const selectHero = (pidx: number, hidx: number) => {
    if (client.selectCardHero(pidx, hidx, updateInfo))
        client.selectHero(pidx, hidx);
    updateInfo();
}
// 选择召唤物
const selectCardSummon = (pidx: number, suidx: number, isNotShow: boolean) => {
    client.selectCardSummon(pidx, suidx);
    if (!isNotShow) client.showSummonInfo(pidx, suidx);
    updateInfo();
}
// 选择场地
const selectCardSite = (pidx: number, siidx: number) => {
    client.selectCardSite(siidx);
    client.showSiteInfo(pidx, siidx);
    updateInfo();
}
// 选择要消费的骰子
const selectUseDice = (dices: boolean[]) => {
    client.selectUseDice(dices);
    updateInfo();
}
// 进入调和模式
const reconcile = (bool: boolean) => {
    client.reconcile(bool);
    updateInfo();
}
// 使用技能
const useSkill = (sidx: number, isOnlyRead: boolean) => {
    client.useSkill(sidx, { isOnlyRead }, updateInfo);
    updateInfo();
}
// 切换角色
const changeHero = debounce(() => {
    client.changeHero();
    updateInfo();
});
// 结束回合
const endPhase = () => {
    client.endPhase();
    updateInfo();
}
// 使用卡
const useCard = () => {
    client.useCard(updateInfo);
    updateInfo();
}

// 切换旁观人
const lookonTo = (idx: number) => {
    if (isLookon.value == -1) return;
    playerIdx = idx;
    client.userid = players.value[playerIdx].id;
    client.getPlayer({ isFlag: true });
    client.handCards = [...client.players[playerIdx].handCards];
    client.updatePlayerPositionInfo();
    updateInfo();
}

socket.emit('roomInfoUpdate', { roomId });
socket.on('roomInfoUpdate', data => {
    const isFlag = data.isStart && !client.isStart;
    client.getPlayer({ isFlag, ...data });
    updateInfo();
});

socket.on('getServerInfo', data => {
    if (data.gameType != 2) return;
    if (isLookon.value == -1 || isLookon.value == playerIdx) {
        client.getServerInfo(data, updateInfo);
        updateInfo();
    } else players.value = [...data.players];
});

// dev
const devOps = (cidx = 0) => {
    if (!isDev) return;
    let ops = prompt('摸牌id/#骰子/@充能/%血量/&附着:')?.split(/[,，\.\/、]+/).filter(v => v != '');
    if (ops == undefined) return;
    const cpidx = playerIdx ^ cidx;
    let heros = client.players[cpidx].heros;
    let dices;
    let flag = new Set<string>();
    let cards: number[] = [];
    const h = (v: string) => v == '' ? undefined : Number(v);
    for (const op of ops) {
        if (op.startsWith('&')) {
            const isAdd = op[1] == '+';
            const [el = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(isAdd ? 2 : 1).split(/[:：]+/).map(h);
            if (!isAdd || el == 0) heros[hidx].attachElement = [];
            if (el > 0) heros[hidx].attachElement.push(el);
            flag.add('setEl');
        } else if (op.startsWith('%')) {
            const [hp = 10, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
            heros[hidx].hp = hp;
            flag.add('setHp');
        } else if (op.startsWith('@')) {
            const [cnt = 1, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
            const { heros: nheros } = client._doCmds([{ cmd: 'getEnergy', cnt, hidxs: [hidx] }], { heros });
            if (nheros) heros = nheros;
            flag.add('setEnergy');
        } else if (op.startsWith('#')) {
            const [cnt = 5, el = 0] = op.slice(1).split(/[:：]+/).map(h);
            const { ndices } = client._doCmds([{ cmd: 'getDice', cnt, element: el }]);
            dices = ndices;
            flag.add('getDice');
        } else {
            const [cid = 0, cnt = 1] = op.split('*').map(h);
            if (cid == 0) cards.push(cardTotal.find(c => c.userType == heros[client.players[cpidx].hidx].id)?.id ?? 0);
            if (cid <= 0) continue;
            cards.push(...new Array(cnt).fill(cid));
            flag.add('getCard');
        }
    }
    socket.emit('sendToServer', { cpidx, heros, dices, cmds: [{ cmd: 'getCard', cnt: cards.length, card: cards }], flag: 'dev-' + [...flag].join('&') });
}

</script>

<style scoped>
body {
    user-select: none;
}

.container {
    width: 100%;
    height: 95vh;
    background-color: #aed1c8;
    position: relative;
    user-select: none;
    overflow: hidden;
}

.player-info {
    position: absolute;
    right: 0;
    top: 0;
    width: 30%;
    height: 20px;
}

.hand-card {
    display: flex;
    flex-direction: row;
    justify-content: center;
    position: absolute;
    bottom: 130px;
    left: 30%;
    background-color: red;
}

.card {
    position: absolute;
    width: 90px;
    height: 140px;
    top: 0;
    border: 2px solid black;
    border-radius: 10px;
    background: #a7bbdd;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
    transition: 0.3s;
}

.card-content {
    position: relative;
    width: 100%;
    height: 100%;
    padding-top: 20px;
}

.card-cost {
    position: absolute;
    left: -20px;
    top: -10px;
    width: 20px;
    height: 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    text-align: center;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-energy {
    position: absolute;
    width: 20px;
    height: 20px;
    left: -20px;
    top: 25px;
    color: white;
    font-weight: bold;
    text-align: center;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cost>span,
.card-energy>span {
    position: absolute;
    left: 20px;
    top: 5px;
}

.card-img {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 10px;
}

.subtype8-border {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    border-radius: inherit;
}

.card.selected {
    transform: translateY(-15px);
}

.skills {
    position: absolute;
    height: 20%;
    bottom: 0;
    right: 5%;
    /* background-color: #81bcff; */
}

.skill {
    display: inline-flex;
    width: 50px;
    flex-wrap: wrap;
    justify-content: center;
    margin-right: 5px;
}

.skill3-bg {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
}

.skill-btn {
    position: relative;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    background-color: #efbb61;
    border: 2px solid #9b8868;
    margin-bottom: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fceacf;
    font-weight: bolder;
    font-size: medium;
    cursor: pointer;
    box-sizing: border-box;
}

.skill-img {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
}

.skill-forbidden {
    position: absolute;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    background-color: #7e5f2ab9;
}

.quick-action {
    text-align: center;
    color: #fff581;
    font-weight: bold;
    margin-bottom: 5px;
}

.skill-cost {
    width: 17px;
    height: 17px;
    border-radius: 40%;
    margin: 0 2px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bolder;
    font-size: medium;
    -webkit-text-stroke: 1px black;
}

.cost-img {
    position: absolute;
    width: 25px;
    height: 25px;
}

.cost-img.hcard {
    width: 30px;
    height: 30px;
}

.start {
    padding: 5px;
    background-color: #0077ff;
    border-radius: 5px;
    width: 200px;
    height: 50px;
    font-size: larger;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -120%);
    user-select: none;
    cursor: pointer;
    border: 4px outset #0053b1;
    z-index: 5;
}

.deck-open {
    padding: 5px;
    background-color: #0077ff;
    border-radius: 5px;
    width: 200px;
    height: 50px;
    font-size: larger;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 20%);
    user-select: none;
    cursor: pointer;
    border: 4px outset #0053b1;
    z-index: 5;
}

.start:hover,
.deck-open:hover {
    background-color: #016ce7;
}

.start:active,
.deck-open:active {
    background-color: #004a9e;
    border: 4px inset #0053b1;
}


.exit {
    position: absolute;
    top: 0;
    left: 0;
    border: 5px outset orange;
    background-color: #be7b00;
    border-radius: 5px;
    cursor: pointer;
    z-index: 6;
}

.exit:hover {
    background-color: #e0aa46;
    border: 5px outset #ffd27e;
}

.exit:active {
    border: 5px inset orange;
}

[class*=player-display] {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100px;
    height: 150px;
    border: 2px solid black;
    border-radius: 5px;
    background-color: #63a0e6;
}

.player-display {
    position: absolute;
    left: 10px;
    bottom: 10px;
}

.player-display-oppo {
    position: absolute;
    right: 10px;
    min-height: 100px;
}

.rest-card {
    border: 2px solid black;
    border-radius: 5px;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    bottom: 5px;
    left: 5px;
    background-color: #5f7b9c;
    color: white;
}

.curr-player {
    box-shadow: 4px 4px 6px #ffeb56,
        -4px 4px 6px #ffeb56,
        4px -4px 6px #ffeb56,
        -4px -4px 6px #ffeb56;
}

.subtype8 {
    position: absolute;
    right: -10px;
    top: -10px;
}

.subtype8-oppo {
    position: absolute;
    left: -10px;
    top: -10px;
}

.tip {
    position: absolute;
    height: 30px;
    width: 95%;
    background-image: linear-gradient(to left, transparent 0%, #ad56006c 35%, #ad56006c 50%, #ad56006c 65%, transparent 100%);
    transition: 1s;
    text-align: center;
    line-height: 30px;
    font-weight: bolder;
    z-index: 20;
}

.tip-enter {
    transform: translateY(-10px);
}

.tip-leave {
    opacity: 0;
    z-index: -20;
}

.modal-action {
    position: absolute;
    top: 40px;
    max-width: 20%;
    min-height: 10%;
    padding: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: 1s;
    color: white;
    background-color: #254162b9;
    border: 5px solid #1c3149b9;
    border-radius: 10px;
}

.modal-action-my {
    left: 20px;
}

.modal-action-oppo {
    right: 20px;
}

.modal-action-leave {
    opacity: 0;
    z-index: -20;
}

.btn-group {
    position: absolute;
    bottom: 10%;
    width: 25%;
    right: 5%;
    display: flex;
    justify-content: space-evenly;
}

.btn-group button {
    background-color: #ffe122;
    border: 3px outset #e1c300;
    border-radius: 5px;
    cursor: pointer;
    padding: 3px 15px;
}

.btn-group button:active {
    background-color: #d0b81d;
    border: 3px inset #e1c300;
}

.btn-group .forbidden {
    background-color: #a8a8a8 !important;
    border: 3px outset #bdbdbd !important;
}

.win-banner {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-50%, -50%);
    text-shadow: 4px 4px 4px #ffca5f, 4px 0px 4px #ffca5f,
        -4px -4px 4px #ffca5f, -4px 0px 4px #ffca5f,
        4px -4px 4px #ffca5f, 0px -4px 4px #ffca5f,
        -4px 4px 4px #ffca5f, 0px 4px 4px #ffca5f;
}

.offline {
    width: 20px;
    height: 30px;
    position: absolute;
    bottom: 3px;
    right: 5px;
}

.lookon {
    width: 30px;
    height: 20px;
    position: absolute;
    left: 50%;
    top: 40px;
    transform: translateX(-50%);
    cursor: pointer;
    z-index: 6;
}

@media screen and (orientation:portrait) {
    .container {
        height: 95vw;
        width: 95vh;
        transform-origin: 0 0;
        transform: rotateZ(90deg) translateY(-100%);
    }

    [class*=player-display] {
        width: 70px;
        height: 100px;
    }

    .hand-card {
        bottom: 95px;
        font-size: medium;
    }

    .card,
    .card-img {
        width: 60px;
    }

    .btn-group button {
        font-size: 12px;
        padding: 3px 12px;
    }

    .rest-card {
        width: 16px;
        height: 16px;
        bottom: 3px;
        left: 3px;
    }

    .hand-pile.oppo {
        transform: translate(-30px, 108px);
    }

    .win-banner {
        top: 20%;
    }
}

.mobile-container {
    font-size: 12px;
}

.mobile-player-display {
    width: 70px;
    height: 100px;
}

.mobile-hand-card {
    bottom: 70px;
    font-size: medium;
}

.mobile-card {
    width: 60px;
    height: 90px;
}

.mobile-rest-card {
    width: 16px;
    height: 16px;
    bottom: 3px;
    left: 3px;
}

.hand-pile.mobile-oppo {
    transform: translate(-30px, 108px);
}

.mobile-btn-group button {
    font-size: 12px;
    padding: 3px 12px;
}

.mobile-win-banner {
    top: 20%;
}

::-webkit-scrollbar {
    width: 5px;
    height: 5px;
    background: transparent;
}

::-webkit-scrollbar-thumb {
    border-radius: 5px;
    background: #335c9973;
}

::-webkit-scrollbar-track {
    background: transparent;
}
</style>