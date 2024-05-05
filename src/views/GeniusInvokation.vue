<template>
  <div class="container" :class="{ 'mobile-container': isMobile }" @click.stop="cancel">
    <button v-if="!client.isStart || isLookon > -1" class="exit" @click.stop="exit">
      返回
    </button>
    <div style="position: absolute;left: 60px;color: white;">房间号{{ roomId }}</div>
    <button v-if="client.isStart && isLookon == -1 && client.phase > 5" class="exit" @click.stop="giveup">
      投降
    </button>
    <div class="player-info">{{ client.player?.info }}</div>
    <button v-if="isLookon == -1 && client.phase < 2" class="start" @click.stop="startGame">
      {{ client.player?.phase == 0 ? "准备开始" : "取消准备" }}
    </button>
    <button v-if="isLookon == -1 && client.player?.phase == 0" class="deck-open" @click.stop="enterEditDeck">
      查看卡组
    </button>

    <div :class="{
      'player-display': true,
      'curr-player': client.player?.status == 1 && client.phase < 7 && client.phase > 2 && client.isWin == -1,
      'mobile-player-display': isMobile,
    }" @click.stop="devOps()">
      <span v-if="isLookon > -1">旁观中......</span>
      <p>{{ client.player?.name }}</p>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        {{ client.player?.handCards?.length ?? 0 }}
      </div>
      <img class="subtype8" :src="getDiceIcon('subtype8-empty')" />
      <img v-if="!client.player?.isUsedSubType8" class="subtype8" :src="getDiceIcon('subtype8')" />
    </div>

    <div v-if="client.opponent" :class="{
      'player-display-oppo': true,
      'curr-player': client.opponent?.status == 1 && client.phase < 7 && client.phase > 2 && client.isWin == -1,
      'mobile-player-display': isMobile,
    }" @click.stop="devOps(1)">
      <p v-if="client.opponent?.name">{{ client.opponent?.name }}</p>
      <p class="ai-btn" v-if="!client.opponent?.name" style="color:aquamarine" @click.stop="addAI">+添加bot</p>
      <p class="ai-btn" v-if="client.opponent.id == 1 && client.phase < 2" style="color:red" @click.stop="removeAI">
        -删除bot
      </p>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        {{ client.opponent?.handCards?.length ?? 0 }}
      </div>
      <img v-if="client.opponent?.isOffline" src="@@/svg/offline.svg" class="offline" alt="断线..." />
      <img v-if="isLookon > -1" src="@@/svg/lookon.svg" class="lookon" alt="旁观"
        @click.stop="lookonTo(client.opponent?.pidx ?? -1)" />
      <img class="subtype8-oppo" :src="getDiceIcon('subtype8-empty')" />
      <img v-if="!client.opponent.isUsedSubType8" class="subtype8-oppo" :src="getDiceIcon('subtype8')" />
    </div>

    <MainDesk v-if="client.phase > 1 || client.isWin > -1" :isMobile="isMobile" :canAction="canAction"
      :afterWinHeros="afterWinHeros" :isLookon="isLookon" :client="client" @select-change-card="selectChangeCard"
      @change-card="changeCard" @reroll="reroll" @select-hero="selectHero" @select-use-dice="selectUseDice"
      @select-site="selectCardSite" @select-summon="selectCardSummon" @end-phase="endPhase"
      @show-history="showHistory" />

    <div class="hand-card" v-if="(client.player?.phase ?? 0) > 2 || client.isWin > -1"
      :class="{ 'mobile-hand-card': isMobile }"
      :style="{ transform: `translateX(-${(24 * client.handCards.length) / 2}px)` }">
      <div v-for="(card, idx) in client.handCards" :key="idx * 1000 + (card?.id ?? 0) + 'myhandcard'" class="card"
        :class="{ selected: card.selected, 'mobile-card': isMobile }" :style="{ left: `${card.pos}px` }"
        @click.stop="selectCard(idx)" @mouseenter="mouseenter(idx)" @mouseleave="mouseleave(idx)">
        <img class="card-img" :src="card.src" v-if="card?.src?.length > 0" :alt="card.name" />
        <img class="subtype8-border" v-if="card.subType?.includes(8)" :src="getPngIcon('subtype8-border')" />
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
          <div class="card-energy" v-if="card.subType?.includes(8)">
            <img class="cost-img hcard" :src="getDiceIcon(ELEMENT_ICON[10])" />
          </div>
        </div>
      </div>
    </div>

    <div class="btn-group" v-if="isLookon == -1 &&
      ((((client.player?.status == 1 && canAction) || client.player?.phase >= 9) && client.player?.phase > 4 &&
        (client.currCard.id > 0 || client.isShowChangeHero > 0)) || client.player?.phase == 3)
    ">
      <button :class="{ forbidden: !client.isValid }" v-if="!client.isReconcile && client.currCard.id > 0 && canAction"
        @click.stop="useCard">
        出牌
      </button>
      <button v-if="client.currCard.id > 0 && canAction" @click.stop="reconcile(true)"
        :style="{ backgroundColor: ELEMENT_COLOR[client.player.heros.find(v => v.isFront)?.element ?? 0] }"
        :class="{ forbidden: client.player.dice.every(v => [0, client.player.heros[client.player.hidx].element].includes(v)) || client.currCard.subType.includes(-5) }">
        调和
      </button>
      <button v-if="client.isReconcile && client.currCard.id > 0" @click.stop="reconcile(false)">
        取消
      </button>
      <div
        v-if="(client.isShowChangeHero > 0 && client.currCard.id <= 0) || (client.player.phase == 3 && client.player.heros.some(h => h.isSelected > 0))"
        style=" display: flex; flex-direction: column; align-items: center; transform: translateY(20px); ">
        <div class="quick-action" v-if="client.isShowChangeHero == 3">
          快速行动
        </div>
        <button :class="{ forbidden: !client.isValid && client.player.phase != 3 }" v-if="client.isShowChangeHero < 2"
          @click.stop="chooseHero">
          {{ client.player.phase == 3 || client.player.phase > 8 ? "出战" : "切换" }}
        </button>
        <button v-else :class="{ forbidden: !client.isValid && client.player.phase != 3 }" @click.stop="changeHero">
          确定
        </button>
        <div class="skill-cost" v-if="client.player.phase == 6"
          :style="{ marginTop: '10px', opacity: client.isShowChangeHero >= 2 ? 1 : 0 }">
          <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[0])" />
          <span
            :style="{ zIndex: 1, color: client.heroChangeDice > 1 ? CHANGE_BAD_COLOR : client.heroChangeDice < 1 ? CHANGE_GOOD_COLOR : 'white' }">
            {{ client.heroChangeDice }}
          </span>
        </div>
      </div>
    </div>
    <div class="skills"
      v-else-if="client.phase > 4 && client.player && client.player.phase > 4 && client.player.heros[client.player.hidx].hp > 0">
      <div class="skill" v-for="(skill, sidx) in client.skills.filter(sk => sk.type < 4)" :key="sidx">
        <div class="skill-btn" @click.stop="useSkill(sidx, false)"
          :style="{ boxShadow: skill.type == 3 && client.player.heros[client.player.hidx].energy >= skill.cost[2].val ? `0px 0px 8px 3px ${ELEMENT_COLOR[skill.cost[0].color]}` : '' }">
          <div class="skill3-bg"
            v-if="skill.type == 3 && client.player.heros[client.player.hidx].energy < skill.cost[2].val"
            :style="{ background: `linear-gradient(to top, ${ELEMENT_COLOR[skill.cost[0].color]} 0%, ${ELEMENT_COLOR[skill.cost[0].color]} ${(client.player.heros[client.player.hidx].energy / skill.cost[2].val) * 100}%, transparent ${(client.player.heros[client.player.hidx].energy / skill.cost[2].val) * 100}%, transparent 100%)` }">
            <div class="skill-btn" style="transform: translate(1px, 1px)"></div>
          </div>
          <img class="skill-img" :src="skill.src" v-if="skill.src.length > 0" :alt="SKILL_TYPE_ABBR[skill.type]" />
          <span v-else class="skill-img">{{ SKILL_TYPE_ABBR[skill.type] }}</span>
        </div>
        <div class="skill-cost" v-for="(cost, cidx) in skill.cost.filter(c => c.val > 0)" :key="cidx"
          :style="{ color: cidx < 2 && skill.costChange[cidx] > 0 ? CHANGE_GOOD_COLOR : cidx < 2 && skill.costChange[cidx] < 0 ? CHANGE_BAD_COLOR : 'white' }">
          <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[cost.color])" />
          <span style="z-index: 1">{{ Math.max(cost.val - (cidx < 2 ? skill.costChange[cidx] : 0), 0) }} </span>
        </div>
        <div class="skill-forbidden" v-if="isLookon > -1 || skill.isForbidden || client.player.status == 0 || !canAction || client.phase > 6 ||
          client.player.heros.find(h => h.isFront)?.inStatus?.some(s => s.type.includes(14))"
          @click.stop="useSkill(sidx, true)"></div>
      </div>
    </div>
  </div>

  <InfoModal v-if="client.phase > 1" :info="client.modalInfo" :isMobile="isMobile" style="z-index: 10" />

  <h1 v-if="client.isWin > 1 && client.players[client.isWin % 2]?.name" class="win-banner"
    :class="{ 'mobile-win-banner': isMobile }">
    {{ client.players[client.isWin % 2]?.name }}获胜！！！
  </h1>

  <h1 v-if="client.error != '' && isDev" class="error">{{ client.error }}</h1>

  <div class="tip" :class="{ 'tip-enter': client.tip.content != '', 'tip-leave': client.tip.content == '' }"
    :style="{ top: client.tip?.top ?? '40%', color: client.tip?.color ?? 'black', pointerEvents: 'none' }">
    {{ client.tip.content }}
  </div>

  <div class="modal-action" :class="{
    'modal-action-my': client.player?.status == 1,
    'modal-action-oppo': client.opponent?.status == 1,
    'modal-action-enter-my': client.player?.status == 1 && client.actionInfo != '',
    'modal-action-enter-oppo': client.opponent?.status == 1 && client.actionInfo != '',
    'modal-action-leave': client.actionInfo == '',
  }">
    {{ client.actionInfo }}
  </div>
  <div class="debug-mask" v-if="isOpenMask" :style="{ opacity: maskOpacity }"></div>
</template>

<script setup lang='ts'>
import { computed, ref, watchEffect, onUnmounted, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Socket } from 'socket.io-client';

import InfoModal from '@/components/InfoModal.vue';
import MainDesk from '@/components/MainDesk.vue';
import GeniusInvokationClient from '@/geniusInovakationClient';
import { ELEMENT_COLOR, SKILL_TYPE_ABBR, CHANGE_GOOD_COLOR, ELEMENT_ICON, CHANGE_BAD_COLOR } from '@/data/constant';
import { cardTotal } from '@/data/cards';
import { getSocket } from '@/store/socket';
import { heroStatus } from '@/data/heroStatus';
import { heroTotal } from '@/data/heros';
import { genShareCode } from '@/data/utils';

const router = useRouter();
const route = useRoute();

const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const isDev = process.env.NODE_ENV == 'development';
const socket: Socket = getSocket(isDev);
const { players: cplayers, isLookon: cisLookon, countdown, follow } = history.state;

const userid = Number(localStorage.getItem('7szh_userid') || '-1'); // 玩家id
const roomId = route.params.roomId; // 房间id
const isLookon = ref<number>(cisLookon ? follow ?? Math.floor(Math.random() * 2) : -1); // 是否旁观
const client = ref(new GeniusInvokationClient(socket, userid, cplayers, isMobile.value, countdown, JSON.parse(localStorage.getItem('GIdecks') || '[]'), Number(localStorage.getItem('GIdeckIdx') || '0'), isLookon.value));

const canAction = computed<boolean>(() => client.value.canAction && client.value.tip.content == '' && client.value.actionInfo == '' && !client.value.taskQueue.isExecuting); // 是否可以操作
const afterWinHeros = ref<Hero[][]>([]); // 游戏结束后显示的角色信息
let clientAI: GeniusInvokationClient | null = null;

// 获取骰子背景
const getDiceIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
  return new URL(`/src/assets/image/${name}-dice-bg.png`, import.meta.url).href;
};

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http')) return name;
  return `/image/${name}.png`;
  return new URL(`/src/assets/image/${name}.png`, import.meta.url).href;
};

// 防抖函数
const debounce = (fn: (...args: any[]) => any, wait: number = 100) => {
  let timer: NodeJS.Timeout | undefined;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = undefined;
    }, wait);
  };
};

watchEffect(() => {
  if (client.value.isWin < 2) {
    afterWinHeros.value = client.value.players.map(p => p.heros);
  }
});

// 鼠标放入
const mouseenter = (idx: number) => {
  client.value.mouseenter(idx);
};
// 鼠标离开
const mouseleave = (idx: number) => {
  client.value.mouseleave(idx);
};
// 取消选择
const cancel = () => {
  if (client.value.player.phase < 2) return;
  client.value.cancel();
};
// 选择要换的卡牌
const selectChangeCard = (idx: number) => {
  client.value.selectChangeCard(idx);
};
// 选择卡牌
const selectCard = (idx: number) => {
  client.value.selectCard(idx);
};
// 开始游戏
const startGame = () => {
  client.value.startGame();
};
// 查看卡组
const enterEditDeck = () => {
  router.push({ name: 'editDeck' });
};
// 返回
const exit = () => {
  socket.emit('exitRoom');
  if (isLookon.value > -1) router.back();
};
// 投降
const giveup = () => {
  const isConfirm = confirm('确定投降吗？');
  if (isConfirm) {
    client.value.giveup();
  }
};
// 换卡
const changeCard = (cidxs: number[]) => {
  client.value.changeCard(cidxs);
};
// 重掷骰子
const reroll = (dices: DiceVO[]) => {
  client.value.reroll(dices);
};
// 选择出战角色
const chooseHero = () => {
  client.value.chooseHero();
};
// 选择角色
const selectHero = (pidx: number, hidx: number) => {
  if (client.value.selectCardHero(pidx, hidx)) {
    client.value.selectHero(pidx, hidx);
  }
};
// 选择召唤物
const selectCardSummon = (pidx: number, suidx: number, isNotShow: boolean) => {
  client.value.selectCardSummon(pidx, suidx);
  if (!isNotShow) client.value.showSummonInfo(pidx, suidx);
};
// 选择场地
const selectCardSite = (pidx: number, siidx: number) => {
  client.value.selectCardSite(siidx);
  client.value.showSiteInfo(pidx, siidx);
};
// 选择要消费的骰子
const selectUseDice = (dices: boolean[]) => {
  client.value.selectUseDice(dices);
};
// 进入调和模式
const reconcile = (bool: boolean) => {
  client.value.reconcile(bool);
};
// 使用技能
const useSkill = (sidx: number, isOnlyRead: boolean) => {
  client.value.useSkill(sidx, { isOnlyRead });
};
// 切换角色
const changeHero = debounce(() => {
  client.value.changeHero();
});
// 结束回合
const endPhase = () => {
  client.value.endPhase();
};
// 使用卡
const useCard = () => {
  client.value.useCard();
};
// 显示历史信息
const showHistory = () => {
  client.value.isShowHistory = true;
};
// 切换旁观人
const lookonTo = (idx: number) => {
  client.value.lookonTo(idx);
};
// 添加AI
const addAI = () => socket.emit('addAI');
// 移除AI
const removeAI = () => {
  socket.emit('removeAI');
  clientAI = null
}

const getPlayerList = ({ plist }: { plist: Player[] }) => {
  const me = plist.find(p => p.id == userid);
  if (me?.rid == -1) router.back();
};
onMounted(() => {
  socket.emit('roomInfoUpdate', { roomId });
  socket.on('roomInfoUpdate', data => {
    const isFlag = data.isStart && !client.value.isStart;
    client.value.roomInfoUpdate({ isFlag, ...data });
  });
  socket.on('getServerInfo', data => {
    client.value.getServerInfo(data);
    if (clientAI != null) clientAI.getServerInfo(data);
  });
  socket.on('getPlayerAndRoomList', getPlayerList);
  socket.on('addAI', ({ players }) => {
    cplayers.length = 0;
    cplayers.push(...players);
    const heroIds = new Set<number>();
    while (heroIds.size < 3) {
      heroIds.add(heroTotal[Math.floor(Math.random() * (heroTotal.length - 1)) + 1].id);
    }
    const deck = [...heroIds];
    const cardIdsMap = new Map<number, number>();
    let cnts = 0;
    while (cnts < 30) {
      const card = cardTotal[Math.floor(Math.random() * (heroTotal.length - 1)) + 1];
      const cid = card.id;
      const cnt = cardIdsMap.get(cid) || 0;
      if (cnt < 2) {
        if (cid > 700 && !heroIds.has(card.userType) || cid > 560 && cid < 600) continue;
        cardIdsMap.set(cid, cnt + 1);
        ++cnts;
      }
    }
    for (const [cid, cnt] of cardIdsMap.entries()) {
      for (let i = 0; i < cnt; ++i) {
        deck.push(cid);
      }
    }
    const shareCode = genShareCode(deck);
    const AIDeck = [{ name: 'AIDeck', shareCode }];
    clientAI = new GeniusInvokationClient(socket, 1, cplayers, false, countdown, AIDeck, 0, -1);
    clientAI.startGame();
  });
});

onUnmounted(() => {
  socket.off('roomInfoUpdate');
  socket.off('getServerInfo');
  socket.off('getPlayerAndRoomList', getPlayerList);
  socket.off('addAI');
});

let prodEnv = 0;
const maskOpacity = ref<number>(0.94);
const isOpenMask = ref<boolean>(false);
// dev
const devOps = (cidx = 0) => {
  if (client.value.phase < 5 || !isDev && ++prodEnv < 3) return;
  let opses = prompt(isDev ? '摸牌id/#骰子/@充能/%血量/&附着/=状态:' : '');
  if (!isDev) {
    if (!opses?.startsWith('debug')) return;
    opses = opses?.slice(5);
    prodEnv = 0;
    if (opses.startsWith('--')) {
      const opacity = +opses.slice(2);
      if (opacity == 1) isOpenMask.value = false;
      else {
        if (opacity > 0) maskOpacity.value = opacity;
        isOpenMask.value = opacity > 0 || !isOpenMask.value;
      }
      opses = null;
    }
  }
  if (!opses) return;
  const ops = opses.split(/[,，\.\/、]+/).filter(v => v != '');
  const cpidx = client.value.playerIdx ^ cidx;
  let heros = client.value.players[cpidx].heros;
  let dices;
  let flag = new Set<string>();
  let cards: (number | Card)[] = [];
  let handCards: Card[] | undefined;
  const cmds: Cmds[] = [];
  const h = (v: string) => (v == '' ? undefined : Number(v));
  for (const op of ops) {
    if (op.startsWith('&')) { // 附着
      const isAdd = op[1] == '+';
      const [el = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(isAdd ? 2 : 1).split(/[:：]+/).map(h);
      if (!isAdd || el == 0) {
        if (hidx > 2) heros.forEach(h => (h.attachElement = []));
        else heros[hidx].attachElement = [];
      }
      if (el > 0) {
        if (hidx > 2) heros.forEach(h => h.attachElement.push(el));
        else heros[hidx].attachElement.push(el);
      }
      flag.add('setEl');
    } else if (op.startsWith('%')) { // 血量
      const [hp = 10, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      if (hidx > 2) heros.forEach(h => (h.hp = hp));
      else heros[hidx].hp = hp;
      flag.add('setHp');
    } else if (op.startsWith('@')) { // 充能
      const [cnt = 3, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      const { heros: nheros } = client.value._doCmds([{ cmd: 'getEnergy', cnt, hidxs: hidx > 2 ? [0, 1, 2] : [hidx] }], { heros });
      if (nheros) heros = nheros;
      flag.add('setEnergy');
    } else if (op.startsWith('#')) { // 骰子
      const [cnt = 16, el = 0] = op.slice(1).split(/[:：]+/).map(h);
      const { ndices } = client.value._doCmds([{ cmd: 'getDice', cnt, element: el }], { pidx: cpidx });
      dices = ndices;
      flag.add('getDice');
    } else if (op.startsWith('-')) { // 弃牌
      if (isNaN(+op)) {
        const rest = op.slice(1);
        const eidx = rest.indexOf('e');
        const cidx = rest.indexOf('c');
        const cdidx = rest.indexOf('cd');
        const hidx = rest.indexOf('h');
        const element = eidx == -1 ? 0 : (parseInt(rest.slice(eidx + 1)) || 0);
        const cnt = cidx == -1 ? 1 : (parseInt(rest.slice(cidx + 1)) || 1);
        const card = cdidx == -1 ? undefined : (parseInt(rest.slice(cdidx + 2)) || undefined);
        const hidxs = hidx == -1 ? undefined : (parseInt(rest.slice(cdidx + 1)) || undefined)?.toString().split('').map(Number) || undefined;
        const dcmds: Cmds[] = [{ cmd: 'discard', element, cnt, card, hidxs }];
        client.value._doCmds(dcmds, { pidx: cpidx });
        cmds.push(...dcmds);
      } else {
        handCards = client.value.player.handCards.slice(0, +op);
      }
      flag.add('disCard');
    } else if (op.startsWith('=')) { // 状态
      const [stsid = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      if (stsid < 2000 || stsid > 3000) continue;
      const sts = heroStatus(stsid);
      const cmd = `get${['In', 'Out'][sts.group]}Status` as Cmd;
      const cmds: Cmds[] = [{ cmd, status: [sts], hidxs: [hidx] }];
      client.value._doCmds(cmds, { heros, isEffectHero: true });
      flag.add('setStatus');
    } else { // 摸牌
      const [cid = 0, cnt = 1] = op.split('*').map(h);
      if (cid == 0) {
        cards.push(cardTotal.find(c => c.userType == heros[client.value.players[cpidx].hidx].id)?.id ?? 0);
      }
      if (cid > 0) cards.push(...new Array(cnt).fill(cid));
      cards = client.value._doCmds([{ cmd: 'getCard', cnt, card: cards }], { pidx: cpidx }).cmds?.[0].card as Card[];
      flag.add('getCard');
      cmds.push({ cmd: 'getCard', cnt: cards.length, card: cards });
    }
  }
  socket.emit('sendToServer', { cpidx, heros, dices, cmds, handCards, flag: 'dev-' + [...flag].join('&') });
};
</script>

<style scoped>
body {
  user-select: none;
}

.container {
  width: 100%;
  height: 95vh;
  /* background-color: #aed1c8; */
  background: url('@@/image/desk_bg.png');
  background-size: cover;
  background-position: center center;
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
  color: white;
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
  display: flex;
  justify-content: center;
  align-items: center;
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

[class*='player-display'] {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100px;
  height: 150px;
  border: 2px solid black;
  border-radius: 5px;
}

.player-display {
  position: absolute;
  left: 10px;
  bottom: 10px;
  background-color: #e0b97e;
}

.player-display-oppo {
  position: absolute;
  top: 10px;
  right: 10px;
  min-height: 100px;
  background-color: #63a0e6;
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
  background-color: #00000042;
  /* background-color: #5f7b9c; */
  color: white;
}

.curr-player {
  box-shadow: 4px 4px 6px #ffeb56, -4px 4px 6px #ffeb56, 4px -4px 6px #ffeb56,
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
  background-image: linear-gradient(to left,
      transparent 0%,
      #ad56006c 35%,
      #ad56006c 50%,
      #ad56006c 65%,
      transparent 100%);
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
  text-shadow: 4px 4px 4px #ffca5f, 4px 0px 4px #ffca5f, -4px -4px 4px #ffca5f,
    -4px 0px 4px #ffca5f, 4px -4px 4px #ffca5f, 0px -4px 4px #ffca5f,
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

.debug-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #dedede;
  z-index: 50;
  pointer-events: none;
}

.ai-btn {
  cursor: pointer;
  padding-top: 20px;
  z-index: 2;
}

.error {
  color: red;
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
}

@media screen and (orientation: portrait) {
  .container {
    height: 95vw;
    width: 95vh;
    transform-origin: 0 0;
    transform: rotateZ(90deg) translateY(-100%);
  }

  [class*='player-display'] {
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
