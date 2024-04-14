<template>
    <div class="edit-deck-container" @click="cancel">
        <button class="edit-btn exit" @click.stop="exit">返回</button>
        <div v-if="editDeckIdx == -1" class="edit-deck-list">
            <div v-for="(deck, did) in decks" :key="'deckid:' + did" class="deck"
                :class="{ 'curr-deck': deckIdx == did }" @click="toEditDeck(did)">
                {{ deck.name }}
                <div v-for="(hero, hidx) in deck.heroIds" :key="hidx" class="deck-hero"
                    :style="{ backgroundColor: ELEMENT_COLOR[hero?.element ?? 0] }">
                    {{ hero?.name || '无' }}
                </div>
                <div class="edit-btn-group">
                    <span v-for="( icon, cidx ) in deckListEditIcon" :key="cidx" class="edit-list-icon"
                        @click.stop="icon.handle(did)">
                        {{ icon.name }}
                    </span>
                </div>
            </div>
        </div>
        <div v-else class="edit-container">
            <button class="edit-btn exit" @click.stop="exit">返回</button>
            <button class="edit-btn save" @click.stop="saveDeck">保存</button>
            <div class="edit-deck-btn-group">
                <button @click.stop="{ currIdx = 0; updateInfo(); }" :class="{ active: currIdx == 0 }">
                    角色
                </button>
                <button @click.stop="{ currIdx = 1; updateInfo(); }" :class="{ active: currIdx == 1 }">
                    卡组
                </button>
            </div>
            <input v-model="deckName" class="deck-name" />
            <button class="edit-btn share" @click.stop="showShareCode">复制分享码</button>
            <input type="text" v-model="pShareCode" class="share-code-input" placeholder="粘贴分享码" />
            <button class="edit-btn share" v-if="pShareCode.length > 0" @click.stop="pasteShareCode">粘贴分享码</button>
            <div class="share-code" v-if="isShowShareCode" @click.stop="">{{ shareCode }}</div>
            <div v-if="currIdx == 0">
                <div class="heros-deck">
                    <div class="hero-deck" :class="{ 'mobile-hero-deck': isMobile }" v-for="(dhero, dhidx) in herosDeck"
                        :key="dhidx" @click.stop="showHeroInfo(dhero.id)">
                        <img class="hero-img" :src="dhero.src" v-if="dhero?.src?.length > 0" :alt="dhero.name"
                            draggable="false" />
                        <span v-else class="hero-img">{{ dhero.name }}</span>
                        <div class="icon-group" v-if="dhero.id > 1000">
                            <span v-for="(icon, cidx) in heroMoveIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dhidx)">
                                {{ icon.name }}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="heros-total">
                    <div class="hero-total" :class="{ 'mobile-hero-deck': isMobile }" v-for="dthero in herosTotal"
                        :key="dthero.id" :style="{ color: ELEMENT_COLOR[dthero.element] }"
                        @click.stop="showHeroInfo(dthero.id)">
                        <span class="hero-img">{{ dthero.name }}</span>
                        <img class="hero-img" :src="dthero.src" v-if="dthero?.src?.length > 0" :alt="dthero.name"
                            draggable="false" />
                        <div class="icon-group" v-if="!dthero.isSelected">
                            <span v-for="(icon, cidx) in heroSelectIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dthero.id)">
                                {{ icon.name }}
                            </span>
                        </div>
                        <div v-else class="selected">已选择</div>
                    </div>
                </div>
            </div>
            <div v-else>
                <div :style="{ position: 'absolute', right: '10%', top: '5%' }">{{ cardsDeckLen }}/30</div>
                <div class="cards-deck">
                    <div class="card-deck" :class="{ 'mobile-card-deck': isMobile }" v-for="(dcard, dcidx) in cardsDeck"
                        :key="dcidx" @click.stop="showCardInfo(dcard.id)">
                        <div class="card-img-content">
                            <span class="card-img">{{ dcard.name }}</span>
                            <img class="card-img" :src="dcard.src" v-if="dcard?.src?.length > 0" :alt="dcard.name"
                                draggable="false" />
                            <img class="subtype8-border" v-if="dcard.subType.includes(8)"
                                :src="getPngIcon('subtype8-border')" />
                        </div>
                        <div class="card-cost">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[dcard.costType])" draggable="false" />
                            <span>{{ dcard.cost }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.anydice ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[0])" draggable="false" />
                            <span>{{ dcard?.anydice ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.energy ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[9])" draggable="false" />
                            <span>{{ dcard?.energy ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.subType.includes(8)">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[10])" draggable="false" />
                        </div>
                        <span class="edit-icon card-select-icon"
                            v-if="(cardsTotal.find(c => c.id === dcard.id)?.cnt ?? -1) > 0"
                            @click.stop="selectCard(dcard.id)">+</span>
                        <span class="edit-icon card-remove-icon" @click.stop="removeCard(dcard.id)">-</span>
                        <div class="card-cnt">{{ dcard.cnt }}</div>
                    </div>
                </div>
                <div class="cards-total">
                    <div class="card-total" :class="{ 'mobile-card-deck': isMobile }"
                        v-for="(dtcard, dtcidx) in cardsTotal" :key="dtcidx" @click.stop="showCardInfo(dtcard.id)">
                        <div class="card-img-content">
                            <span class="card-img">{{ dtcard.name }}</span>
                            <img class="card-img" :src="dtcard.src" v-if="dtcard?.src?.length > 0" :alt="dtcard.name"
                                draggable="false" />
                            <img class="subtype8-border" v-if="dtcard.subType.includes(8)"
                                :src="getPngIcon('subtype8-border')" />
                        </div>
                        <div class="card-cost">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[dtcard.costType])" draggable="false" />
                            <span>{{ dtcard.cost }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.anydice ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[0])" draggable="false" />
                            <span>{{ dtcard?.anydice ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.energy ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[9])" draggable="false" />
                            <span>{{ dtcard?.energy ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.subType.includes(8)">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[10])" draggable="false" />
                        </div>
                        <div class="forbidden" v-if="dtcard.cnt == -1">
                            已失效
                        </div>
                        <span class="edit-icon card-select-icon" @click.stop="selectCard(dtcard.id)"
                            v-else-if="dtcard.cnt > 0">+</span>
                        <div v-else class="selected">已选完</div>
                        <span class="edit-icon card-remove-icon" @click.stop="removeCard(dtcard.id)"
                            v-if="dtcard.cnt >= 0 && cardsDeck.some(c => c.id == dtcard.id)">-</span>
                        <div class="card-cnt" v-if="dtcard.cnt >= 0">{{ dtcard.cnt }}</div>
                    </div>
                </div>
            </div>
            <button class="edit-btn filter" @click.stop="showFilter">筛选</button>
            <button class="edit-btn reset" @click="reset">重置</button>
            <div class="filter-condition" v-if="isShowFilter" @click.stop="">
                <div v-for="(htitle, hidx) in (currIdx == 0 ? heroFilter : cardFilter)" :key="hidx">
                    <div class="filter-title">{{ htitle.name }}</div>
                    <div class="filter-tags">
                        <span class="filter-tag" :class="{ 'active': val.tap }" v-for="(val, sidx) in htitle.value"
                            :key="sidx" @click.stop="selectFilter(hidx, sidx)">
                            {{ val.name }}
                        </span>
                    </div>
                </div>
            </div>
            <div class="filter-selected" v-if="filterSelected.length > 0">
                <span class="filter-tag active" v-for="(stag, atidx) in filterSelected" :key="atidx">
                    {{ stag }}
                </span>
            </div>
        </div>
    </div>
    <InfoModal :info="modalInfo" :isMobile="isMobile" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ELEMENT, ELEMENT_COLOR, ELEMENT_ICON, CARD_TYPE, CARD_SUBTYPE, HERO_LOCAL, WEAPON_TYPE } from '@/data/constant';
import { cardTotal } from '@/data/cards';
import { heroTotal, herosTotal as herosAll } from '@/data/heros';
import InfoModal from '@/components/InfoModal.vue';
import { clone, genShareCode, parseShareCode } from '@/data/utils';
import { useRouter } from 'vue-router';

type Filter = {
    name: string,
    value: {
        name: string,
        val: number,
        tap: boolean,
    }[]
}

const router = useRouter();

const herosPool: Hero[] = clone(heroTotal).filter((h: Hero) => h.id < 1850); // 选择的角色池
const cardsPool: Card[] = clone(cardTotal).filter(c => c.id < 900); // 选择的卡组池
const OriDecks = ref<OriDeck[]>(JSON.parse(localStorage.getItem('GIdecks') || '[]')); // 原始卡组列表
const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)); // 是否为手机

const currIdx = ref<number>(0); // 当前选择的tab：0角色 1卡组
const herosTotal = ref<Hero[]>([...herosPool]); // 可选择角色池
const cardsTotal = ref<Card[]>([...cardsPool]); // 可选择卡池
const herosDeck = ref<Hero[]>([]); // 当前角色组
const cardsDeck = ref<Card[]>([]); // 当前卡组
const decks = computed<DeckVO[]>(() => OriDecks.value.map(deck => {
    const { heroIds, cardIds } = parseShareCode(deck.shareCode);
    return {
        name: deck.name,
        heroIds: heroIds.map(hid => {
            const hero = herosAll(hid);
            return {
                id: hero?.id ?? 1000,
                name: hero?.name ?? '无',
                element: hero?.element ?? 0,
                local: hero?.local ?? [],
                src: hero?.src ?? '',
            }
        }),
        cardIds,
    }
})); // 卡组列表
const editDeckIdx = ref<number>(-1); // 当前编辑卡组索引
const deckName = ref<string>(''); // 卡组名字
const editDeck = ref<{ heroIds: number[], cardIds: number[] }>({ heroIds: [], cardIds: [] }); // 当前编辑卡组
const deckIdx = ref<number>(Number(localStorage.getItem('GIdeckIdx') || 0)); // 出战卡组id
const cardsDeckLen = ref<number>(0); // 卡组数量
const modalInfo = ref<InfoVO>({ isShow: false, type: -1, info: null });
const deckListEditIcon = ref([
    { name: '战', handle: (idx: number) => selectDeck(idx) },
    { name: '删', handle: (idx: number) => deleteDeck(idx) },
]);
const heroSelectIcon = ref([
    { name: '左', handle: (idx: number) => selectHero(0, idx) },
    { name: '中', handle: (idx: number) => selectHero(1, idx) },
    { name: '右', handle: (idx: number) => selectHero(2, idx) },
]);
const heroMoveIcon = ref([
    { name: '←', handle: (pos: number) => MoveHero(pos, -1) },
    { name: '↓', handle: (pos: number) => MoveHero(pos, 0) },
    { name: '→', handle: (pos: number) => MoveHero(pos, 1) },
]);
const heroFilter = ref<Filter[]>([]);
const cardFilter = ref<Filter[]>([]);
const filterSelected = ref<string[]>([]);
const isShowFilter = ref<boolean>(false);
const isShowShareCode = ref<boolean>(false);
const shareCode = ref<string>('');
const pShareCode = ref<string>('');

// 获取png图片
const getPngIcon = (name: string) => {
    if (name.startsWith('http')) return name;
    return `/image/${name}.png`;
    return new URL(`/src/assets/image/${name}.png`, import.meta.url).href;
}

// 选择出战卡组
const selectDeck = (didx: number) => {
    deckIdx.value = didx;
    localStorage.setItem('GIdeckIdx', didx.toString());
}

// 保存卡组
const saveDeck = () => {
    updateShareCode();
    OriDecks.value[editDeckIdx.value] = {
        name: deckName.value || '默认卡组',
        shareCode: shareCode.value,
    }
    localStorage.setItem('GIdecks', JSON.stringify(OriDecks.value));
    editDeckIdx.value = -1;
}

// 删除卡组
const deleteDeck = (did: number) => {
    const isConfirm = confirm('确认删除？');
    if (isConfirm) {
        OriDecks.value[did] = {
            name: '默认卡组',
            shareCode: genShareCode([0, 0, 0]),
        }
        localStorage.setItem('GIdecks', JSON.stringify(decks));
    }
}

// 重置角色筛选
const resetHeroFilter = () => {
    heroFilter.value = [];
    const heroFilterTitle = ['所属', '元素', '武器'];
    [HERO_LOCAL, ELEMENT.slice(1, 8).map(v => v[0]), WEAPON_TYPE].forEach((arr, aidx) => {
        const res: Filter = { name: heroFilterTitle[aidx], value: [] };
        for (let i = 0; i < arr.length; ++i) {
            res.value.push({ name: arr[i], val: i + (aidx == 1 ? 1 : 0), tap: false });
        }
        heroFilter.value.push(res);
    });
}

// 重置卡牌筛选
const resetCardFilter = () => {
    cardFilter.value = [];
    const cardFilterTitle = ['类型', '副类型', '花费', '花费类型'];
    const cost = [0, 1, 2, 3, 4, 5];
    const costType = ['任意', ...ELEMENT.slice(1, 8).map(v => v[0]), '同色'];
    [CARD_TYPE, CARD_SUBTYPE, cost, costType].forEach((arr, aidx) => {
        const res: Filter = { name: cardFilterTitle[aidx], value: [] };
        for (let i = 0; i < arr.length; ++i) {
            res.value.push({ name: arr[i].toString(), val: i, tap: false });
        }
        cardFilter.value.push(res);
    });
}

const updateInfo = (init = false) => {
    if (currIdx.value == 0 || init) {
        herosTotal.value = [];
        const heroIds = herosDeck.value.map(v => v.id);
        herosPool.forEach(h => {
            if (h.id > 1000) {
                h.isSelected = heroIds.includes(h.id) ? 1 : 0;
                herosTotal.value.push(h);
            }
        });
    }
    if (currIdx.value == 1 || init) {
        cardsTotal.value = [];
        cardsPool.forEach(c => {
            const cnt = c.cnt - (cardsDeck.value.find(cd => cd.id == c.id)?.cnt ?? 0);
            if (c.id > 0) cardsTotal.value.push({ ...c, cnt });
        });
        cardsDeck.value.sort((a, b) => a.id - b.id);
    }
    const elMap = new Array(8).fill(0);
    const lcMap = new Array(13).fill(0);
    herosDeck.value.forEach(h => {
        ++elMap[h.element];
        h.local.forEach(l => ++lcMap[l]);
    });
    cardsDeck.value = cardsDeck.value.filter(c => {
        if (c.subType.includes(6)) { // 天赋牌
            return herosDeck.value.map(h => h.id).includes(c.userType);
        }
        if (c.subType.includes(9)) { // 元素共鸣
            const element = elMap.findIndex(el => el > 1);
            if (element == -1) return false;
            return [579 + element * 2, 580 + element * 2].includes(c.id);
        }
        if (c.id >= 570 && c.id < 580) { // 所属地区(包括魔物、愚人众)
            const local = lcMap.map((lc, lci) => lc > 1 ? lci + 570 : -1).filter(v => v > -1);
            return local.includes(c.id);
        }
        return true;
    });
    const talentIdxs = [];
    for (let i = 0; i < 3; ++i) {
        const talentIdx = cardsTotal.value.findIndex(c => c.subType.includes(6) && herosDeck.value.some(h => h.id == c.userType));
        if (talentIdx == -1) break;
        talentIdxs.push(...cardsTotal.value.splice(talentIdx, 1));
    }
    cardsTotal.value.unshift(...talentIdxs);
    cardsTotal.value.forEach(c => {
        if (c.subType.includes(6)) { // 天赋牌
            if (!herosDeck.value.some(h => h.id == c.userType)) c.cnt = -1;
            else if (c.cnt == -1) c.cnt = 2;
        } else if (c.subType.includes(9)) { // 元素共鸣
            const element = elMap.findIndex(el => el > 1);
            if (element == -1 || ![579 + element * 2, 580 + element * 2].includes(c.id)) c.cnt = -1;
            else if (c.cnt == -1) c.cnt = 2;
        } else if (c.subType.includes(-3)) { // 所属地区(包括魔物、愚人众)
            const local = lcMap.map((lc, lci) => lc > 1 ? lci + 570 : -1).filter(v => v > -1);
            if (!local.includes(c.id)) c.cnt = -1;
            else if (c.cnt == -1) c.cnt = 2;
        }
    });
    const cardFilterRes: number[][] = cardFilter.value.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    });
    cardsTotal.value = cardsTotal.value.filter(c => {
        const t = cardFilterRes[0].length == 0 || cardFilterRes[0].includes(c.type);
        const st = cardFilterRes[1].length == 0 || cardFilterRes[1].every(v => c.subType.includes(v));
        const co = cardFilterRes[2].length == 0 || cardFilterRes[2].includes(c.cost + c.anydice);
        const ct = cardFilterRes[3].length == 0 || cardFilterRes[3].includes(c.costType);
        return t && st && co && ct;
    }).sort((a, b) => {
        if (a.cnt == -1 && b.cnt != -1) return 1;
        if (a.cnt != -1 && b.cnt == -1) return -1;
        return 0;
    });
    const heroFilterRes: number[][] = heroFilter.value.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    });
    herosTotal.value = herosTotal.value.filter(h => {
        const l = heroFilterRes[0].length == 0 || heroFilterRes[0].every(hl => h.local.includes(hl));
        const e = heroFilterRes[1].length == 0 || heroFilterRes[1].includes(h.element);
        const w = heroFilterRes[2].length == 0 || heroFilterRes[2].includes(h.weaponType);
        return l && e && w;
    });
    cardsDeckLen.value = cardsDeck.value.map(v => v.cnt).reduce((a, b) => a + b, 0);
    filterSelected.value = (currIdx.value == 0 ? heroFilter : cardFilter).value
        .filter(ftype => ftype.value.filter(v => v.tap).length > 0)
        .flatMap(ftype => ftype.value.filter(v => v.tap).map(v => v.name));
}


// 获取骰子背景
const getDiceIcon = (name: string) => {
    return `/image/${name}-dice-bg.png`;
    return new URL(`/src/assets/image/${name}-dice-bg.png`, import.meta.url).href;
}

// 进入编辑卡组界面
const toEditDeck = (did: number) => {
    editDeckIdx.value = did;
    currIdx.value = 0;
    deckName.value = OriDecks.value[did].name;
    editDeck.value = { ...parseShareCode(OriDecks.value[did].shareCode) };
    herosDeck.value = editDeck.value.heroIds.map((hid: number) => {
        if (typeof hid != 'number') return hid;
        return { ...(herosPool.find(v => v.id == hid) ?? herosPool[0]) };
    });
    cardsDeck.value = [];
    editDeck.value.cardIds.forEach((cid: number) => {
        const card = { ...(cardsPool.find(v => v.id == cid) ?? cardsPool[0]), cnt: 1 };
        const dCard = cardsDeck.value.find(c => c.id == card.id);
        if (dCard == undefined) cardsDeck.value.push(card);
        else ++dCard.cnt;
    });
    resetCardFilter();
    resetHeroFilter();
    updateInfo(true);
}

// 更新分享码
const updateShareCode = () => {
    shareCode.value = genShareCode((herosDeck.value.map(v => v.id).concat(cardsDeck.value.flatMap(v => v.cnt == 1 ? v.id : [v.id, v.id]))));
}

// 返回
const exit = () => {
    if (editDeckIdx.value == -1) {
        router.back();
        return;
    }
    editDeckIdx.value = -1;
}

// 选择角色
const selectHero = (pos: number, hid: number) => {
    cancel();
    herosDeck.value[pos] = { ...(herosTotal.value.find(v => v.id == hid) ?? herosTotal.value[0]) };
    updateInfo();
}

// 移动角色
const MoveHero = (pos: number, dir: number) => {
    cancel();
    if (dir == 0) {
        herosDeck.value[pos] = { ...herosPool[0] };
        updateInfo();
    } else {
        const npos = (pos + dir + 3) % 3;
        [herosDeck.value[pos], herosDeck.value[npos]] = [herosDeck.value[npos], herosDeck.value[pos]];
    }

}

// 选择卡片
const selectCard = (cid: number) => {
    cancel();
    if (cardsDeckLen.value >= 30) return alert('卡组已满');
    const card: Card = cardsTotal.value.find(c => c.id == cid) ?? cardsTotal.value[0];
    --card.cnt;
    const curCard = cardsDeck.value.find(cd => cd.id == card.id);
    if (curCard == undefined) cardsDeck.value.push({ ...card, cnt: 1 });
    else curCard.cnt = card.subType.includes(8) ? 1 : 2 - card.cnt;
    updateInfo();
    cancel();
}

// 移除卡片
const removeCard = (cid: number) => {
    cancel();
    const cidx: number = cardsDeck.value.findIndex(c => c.id == cid);
    const card: Card = cardsDeck.value[cidx];
    if (--card.cnt <= 0) cardsDeck.value.splice(cidx, 1);
    updateInfo();
    cancel();
}

// 显示角色信息
const showHeroInfo = (hid: number) => {
    if (hid <= 1000) return;
    modalInfo.value = {
        isShow: true,
        type: 4,
        info: herosPool.find(h => h.id == hid) ?? herosPool[0],
    }
}

// 显示卡片信息
const showCardInfo = (cid: number) => {
    if (cid <= 0) return;
    modalInfo.value = {
        isShow: true,
        type: 5,
        info: cardsPool.find(c => c.id == cid) ?? cardsPool[0],
    }
}

const selectFilter = (tidx: number, vidx: number) => {
    const tags = (currIdx.value == 0 ? heroFilter : cardFilter).value[tidx].value;
    const select = tags[vidx];
    select.tap = !select.tap;
    if (currIdx.value == 0 && [1, 2].includes(tidx) || currIdx.value == 1 && [0, 2, 3].includes(tidx)) {
        tags.forEach((v, vi) => {
            if (vi != vidx) v.tap = false;
        });
    }
    updateInfo();
}

const showFilter = () => {
    isShowFilter.value = !isShowFilter.value;
}

const showShareCode = () => {
    isShowShareCode.value = true;
    updateShareCode();
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(shareCode.value).then(() => confirm('已成功复制到剪贴板'))
            .catch(err => alert('无法复制到剪贴板:' + err));
    } else if (document.execCommand) {
        var textArea = document.createElement('textarea');
        textArea.value = shareCode.value;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        setTimeout(() => {
            document.execCommand('copy');
            textArea.remove();
            confirm('已成功复制到剪贴板')
        }, 0);
    } else {
        alert('无法复制到剪贴板');
    }
}

const pasteShareCode = () => {
    const { heroIds, cardIds } = parseShareCode(pShareCode.value);
    herosDeck.value.forEach((_, hi, ha) => {
        ha[hi] = herosPool.find(v => v.id == heroIds[hi]) ?? herosPool[0];
    });
    cardsDeck.value = [];
    for (const cid of cardIds) {
        const card = cardsDeck.value.find(c => c.id == cid);
        if (card == undefined) {
            cardsDeck.value.push({ ...(cardsPool.find(c => c.id == cid) ?? cardsPool[0]), cnt: 1 });
        } else {
            ++card.cnt;
        }
    }
    updateShareCode();
    pShareCode.value = '';
}

const reset = () => {
    if (currIdx.value == 0) resetHeroFilter();
    else resetCardFilter();
    updateInfo();
}

const cancel = () => {
    isShowFilter.value = false;
    isShowShareCode.value = false;
    modalInfo.value = {
        isShow: false,
        type: -1,
        info: null,
    }
}


</script>

<style scoped>
body div {
    user-select: none;
}

.edit-deck-container {
    position: relative;
    width: 100%;
    height: 95vh;
    background-color: #daa98a;
    overflow: hidden;
}

.edit-deck-list {
    width: 100%;
    background-color: #db8803;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    overflow-x: auto;
    white-space: nowrap;
    border-top: 10px solid #572e00;
    border-bottom: 10px solid #572e00;
    padding: 5px 10px;
    box-sizing: border-box;
}

.deck {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 200px;
    width: 100px;
    background-color: #ddba54;
    margin: 5px;
    padding: 5px;
    border-radius: 10px;
    cursor: pointer;
}

.deck:hover,
.deck:active {
    background-color: #daaf2f;
}

.deck-hero {
    height: 22%;
    width: 95%;
    margin: 3px 0;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #775900;
}

.edit-btn-group {
    margin-top: 5px;
}

.edit-list-icon {
    padding: 0 10px;
    margin: 5px;
    border: 2px solid black;
    border-radius: 5px;
    cursor: pointer;
}

.edit-list-icon:hover,
.edit-list-icon:active {
    background-color: #8a5a00;
    color: white;
}

.edit-deck {
    width: 100%;
    height: 100%;
    background-color: #daa98a;
    position: absolute;
    padding: 5px 10px;
    box-sizing: border-box;
}

.edit-btn {
    border: 5px outset orange;
    background-color: #be7b00;
    cursor: pointer;
    border-radius: 5px;
}

.edit-btn:hover {
    background-color: #e0aa46;
    border: 5px outset #ffd27e;
}

.edit-btn:active {
    background-color: #e0aa46;
    border: 5px inset #ffd27e;
}

.edit-btn.exit {
    position: absolute;
    top: 0;
    left: 0;
}

.edit-btn.save {
    position: absolute;
    top: 0;
    left: 50px;
}

.edit-btn.filter {
    position: absolute;
    bottom: 5px;
    left: 5px;
}

.edit-btn.reset {
    position: absolute;
    bottom: 5px;
    left: 55px;
}

.edit-btn.share {
    transform: translate(20px);
}

.share-code {
    user-select: all;
    position: absolute;
    top: 40px;
    left: 80px;
    width: 80%;
    background-color: #d38900;
    border: 3px solid #583a01;
    word-break: break-all;
    text-align: center;
    padding: 10px;
    margin: 5px;
    border-radius: 10px;
    z-index: 10;
}

.deck-name {
    margin-left: 15%;
    background-color: #daa98a;
    border: 0;
    padding: 5px;
}

.share-code-input {
    margin-left: 5%;
    background-color: #daa98a;
    border: 0;
    padding: 5px;
    width: 80px;
}

.edit-deck-btn-group {
    position: absolute;
    top: 50px;
    left: 0;
    display: flex;
    flex-direction: column;
}

.edit-deck-btn-group button {
    background-color: #925f00;
    border: 3px solid #583a01;
    padding: 10px 2px;
    margin: 5px;
    border-radius: 10px;
    cursor: pointer;
}

.edit-deck-btn-group button:hover,
.edit-deck-btn-group button:active {
    background-color: #d2a858;
}

.edit-deck-btn-group button.active {
    background-color: #ffcf77;
}

.heros-deck {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-50%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 30%;
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-radius: 15px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.cards-deck {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-50%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 35%;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-radius: 15px;
    padding: 0 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-deck {
    position: relative;
    background-color: #ffd0a2;
    width: 120px;
    height: 80%;
    border-radius: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    overflow: hidden;
}

.heros-total,
.cards-total {
    position: absolute;
    left: 50%;
    bottom: 20%;
    transform: translate(-50%, 20%);
    background-color: #d59b3f;
    width: 80%;
    height: 35%;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-radius: 15px;
    padding: 0 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-total,
.card-total,
.card-deck {
    position: relative;
    background-color: #ffd0a2;
    width: 120px;
    height: 90%;
    border-radius: 10px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    margin: 5px;
    margin-bottom: 10px;
    cursor: pointer;
}

.hero-total {
    overflow: hidden;
}

.card-img-content {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    overflow: hidden;
}

.hero-img,
.card-img {
    position: absolute;
    top: 0;
    width: 100%;
    text-align: center;
    line-height: 500%;
}

.curr-deck {
    box-shadow: 4px 4px 6px #ffeb56,
        -4px 4px 6px #ffeb56,
        4px -4px 6px #ffeb56,
        -4px -4px 6px #ffeb56;
}


.subtype8-border {
    position: absolute;
    width: 100%;
    height: 100%;
}

.card-cost {
    position: absolute;
    left: 0;
    top: 0;
    text-align: center;
    color: white;
    font-weight: bold;
    width: 20px;
    height: 20px;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cost>span,
.card-energy>span {
    position: absolute;
    left: 0;
    top: 0;
}

.dice-img {
    position: absolute;
    left: -10px;
    top: -5px;
    width: 30px;
}

.card-energy {
    position: absolute;
    left: 0;
    top: 30px;
    text-align: center;
    color: white;
    font-weight: bold;
    width: 20px;
    height: 20px;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cnt {
    background-color: #583a01;
    color: white;
    border: 2px solid black;
    border-radius: 10px;
    position: absolute;
    top: 3px;
    right: 3px;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.icon-group {
    position: absolute;
    display: flex;
    bottom: 5px;
    width: 100%;
    justify-content: space-around;
}

.edit-icon {
    padding: 0 5px;
    border: 2px solid black;
    border-radius: 5px;
    cursor: pointer;
    color: black;
    background: white;
}

.card-select-icon {
    position: absolute;
    bottom: 5px;
    right: 5px;
    min-width: 12px;
    text-align: center;
}

.card-remove-icon {
    position: absolute;
    bottom: 5px;
    left: 5px;
    min-width: 12px;
    text-align: center;
}

.forbidden {
    position: absolute;
    width: 100%;
    background: #ffb6b6f1;
    padding: 3px 0;
    color: red;
    font-weight: bold;
    text-align: center;
    box-sizing: border-box;
}

.selected {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding-top: 50%;
    background: #0000009e;
    border-radius: inherit;
    color: white;
    text-align: center;
    box-sizing: border-box;
}

.filter-condition {
    position: absolute;
    bottom: 40px;
    left: 5px;
    border-radius: 10px;
    border: 4px solid #001b73;
    background-color: #566bb7;
    color: white;
    box-sizing: border-box;
    max-height: 70%;
    max-width: 50%;
    overflow: auto;
    padding: 5px;
}

.filter-title {
    padding: 5px;
    font-weight: bolder;
}

.filter-tags {
    display: flex;
    flex-wrap: wrap;
}

.filter-tag {
    border: 2px solid #343b7d;
    background-color: #3a457d;
    margin: 4px 2px;
    padding: 3px 10px;
    border-radius: 5px;
    cursor: pointer;
    box-sizing: border-box;
}

.filter-tag:active,
.filter-tag.active {
    background-color: #4b65cd;
}

.filter-selected {
    position: absolute;
    bottom: 10px;
    left: 110px;
}

.mobile-card-deck {
    width: 65px;
}

::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    background: transparent;
}

::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: #335c9973;
}

::-webkit-scrollbar-track {
    background: transparent;
}
</style>