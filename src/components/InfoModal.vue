<template>
  <div class="info-outer-container">
    <div class="info-container" :class="{ 'mobile-font': isMobile }" v-if="isShow" @click.stop="">
      <div v-if="type == 5" @click.stop="showRule((info as Card).description, ...skillExplain.flat(2))">
        <div class="name">{{ (info as Card).name }}</div>
        <div>
          <div class="info-card-cost">
            <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[(info as Card).costType])" />
            <span>{{ (info as Card).cost }}</span>
          </div>
          <div class="info-card-energy" v-if="(info as Card).anydice > 0">
            <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[0])" />
            <span>{{ (info as Card).anydice }}</span>
          </div>
          <div class="info-card-energy" v-if="(info as Card).energy > 0">
            <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[9])" />
            <span>{{ (info as Card).energy }}</span>
          </div>
        </div>
        <div class="info-card-type">{{ CARD_TYPE[(info as Card).type] }}</div>
        <div class="info-card-type sub" v-for="(subtype, suidx) in (info as Card).subType.filter(v => v > -1)"
          :key="suidx">
          {{ CARD_SUBTYPE[subtype] }}
        </div>
        <div v-if="(info as Card).subType.includes(0)" class="info-card-type sub">
          {{ WEAPON_TYPE[(info as Card).userType] }}
        </div>
        <div class="info-card-desc" v-for="(desc, didx) in (info as Card).descriptions" :key="didx" v-html="desc"></div>
        <div class="info-card-explain" v-for="(expl, eidx) in skillExplain" :key="eidx" style="margin-top: 5px">
          <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
        </div>
      </div>
      <div v-if="type < 5">
        <div v-if="type == 4" class="name">{{ (info as Hero).name }}</div>
        <div v-if="type == 4" class="info-hero-tag">
          <span>{{ ELEMENT[(info as Hero).element] }}</span>
          <span>{{ WEAPON_TYPE[(info as Hero).weaponType] }}</span>
          <span v-for="(local, lidx) in (info as Hero).local" :key="lidx">{{
            HERO_LOCAL[local]
          }}</span>
        </div>
        <div class="info-hero-skill" v-for="(skill, sidx) in (skills as Skill[]).filter(
          (_, i) => type == 4 || i == type
        )" :key="sidx">
          <div class="info-hero-skill-title" @click.stop="showDesc(isShowSkill, sidx)">
            <div style="display: flex; flex-direction: row; align-items: center">
              <img class="skill-img" :src="skill.src" v-if="skill.src.length > 0" :alt="SKILL_TYPE_ABBR[skill.type]" />
              <span v-else class="skill-img"
                style=" border-radius: 50%; text-align: center; line-height: 35px; border: 1px solid black; ">
                {{ SKILL_TYPE_ABBR[skill.type] }}
              </span>
              <span class="info-skill-costs">
                <div>{{ skill.name }}</div>
                <div>
                  <div class="skill-cost" v-for="(cost, cidx) in (skill as Skill).cost.filter(c => c.val > 0)"
                    :key="cidx"
                    :style="{ color: cidx < 2 && skill.costChange[cidx] > 0 ? CHANGE_GOOD_COLOR : cidx < 2 && skill.costChange[cidx] < 0 ? CHANGE_BAD_COLOR : 'white' }">
                    <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[cost.color])" />
                    <span>{{ Math.max(cost.val - (cidx < 2 ? skill.costChange[cidx] : 0), 0) }}</span>
                  </div>
                </div>
              </span>
            </div>
            <span>{{ isShowSkill[sidx] ? "▲" : "▼" }}</span>
          </div>
          <div class="info-hero-skill-desc" v-if="isShowSkill[sidx]"
            @click.stop="showRule(skill.description, ...skillExplain[type < 4 ? type : sidx].flat(2))">
            <div class="skill-type">{{ SKILL_TYPE[skill.type] }}</div>
            <div v-for="(desc, didx) in skill.descriptions" :key="didx" v-html="desc"></div>
          </div>
          <div v-if="isShowSkill[sidx] && skillExplain[type < 4 ? type : sidx].length > 0"
            @click.stop=" showRule(skill.description, ...skillExplain[type < 4 ? type : sidx].flat(2))">
            <div class="info-hero-skill-explain" v-for="(expl, eidx) in skillExplain[type < 4 ? type : sidx]"
              :key="eidx">
              <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
            </div>
          </div>
        </div>
        <div v-if="type != 4">
          <div class="info-equipment"
            v-if="(info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot">
            <div class="title">- 角色装备 -</div>
            <div class="equipment"
              v-for="(slot, slidx) in [(info as Hero).weaponSlot, (info as Hero).artifactSlot, (info as Hero).talentSlot].filter(s => s != null)"
              :key="slidx">
              <div class="equipment-title" @click.stop="showDesc(isEquipment, slidx)">
                <span class="equipment-title-left">
                  <img
                    :src="getIcon((slot as Card).subType.includes(0) ? 'weapon' : (slot as Card).subType.includes(1) ? 'artifact' : 'talent')" />
                  <div class="status-cnt" v-if="(slot as Card).useCnt > -1">
                    {{ Math.floor((slot as Card).useCnt) }}
                  </div>
                  <span>{{ (slot as Card).name }}</span>
                </span>
                <span>{{ isEquipment[slidx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isEquipment[slidx]"
                @click.stop="showRule((slot as Card).description, ...slotExplain[slidx].flat(2))">
                <div class="equipment-desc" v-for="(desc, didx) in (slot as Card).descriptions" :key="didx"
                  v-html="desc"></div>
                <div class="info-card-explain" v-for="(expl, eidx) in slotExplain[slidx]" :key="eidx">
                  <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                  {{ slotExplain }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="(info as Hero).inStatus.length > 0" class="info-status">
            <div class="title">- 角色状态 -</div>
            <div v-for="(ist, idx) in (info as Hero).inStatus.filter(sts => !sts.type.includes(0))" :key="ist.id"
              class="status">
              <div class="status-title" @click.stop="showDesc(isInStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ist.iconBg }"></div>
                    <img v-if="ist.icon != ''" :src="getPngIcon(ist.icon)" :style="{
                      filter: ist.icon.startsWith('https') || ist.icon.startsWith('buff') || ist.icon.endsWith('dice') ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR.indexOf(ist.iconBg)})` : ''
                    }" />
                    <div v-else style="color: white;">{{ ist.name[0] }}</div>
                    <div class="status-cnt" v-if="!ist.type.includes(10) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
                      {{ ist.useCnt < 0 ? ist.roundCnt : ist.useCnt }} </div>
                    </div>
                    <span>{{ ist.name }}</span>
                </span>
                <span>{{ isInStatus[idx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isInStatus[idx]" @click.stop=" showRule(ist.description, ...inStatusExplain[idx].flat(2))">
                <div class="status-desc" v-for="(desc, didx) in ist.descriptions" :key="didx" v-html="desc"></div>
                <div v-if="inStatusExplain[idx].length > 0">
                  <div class="info-hero-status-explain" v-for="(expl, eidx) in inStatusExplain[idx]" :key="eidx">
                    <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="(info as Hero).outStatus.length > 0" class="info-status">
            <div class="title">- 阵营出战状态 -</div>
            <div v-for="(ost, idx) in (info as Hero).outStatus.filter(sts => !sts.type.includes(0))" :key="ost.id"
              class="status">
              <div class="status-title" @click.stop="showDesc(isOutStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ost.iconBg }"></div>
                    <img v-if="ost.icon != ''" :src="getPngIcon(ost.icon)"
                      :style="{ filter: ost.icon.startsWith('https') || ost.icon.startsWith('buff') || ost.icon.endsWith('dice') ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR.indexOf(ost.iconBg)})` : '' }" />
                    <div v-else style="color: white;">{{ ost.name[0] }}</div>
                    <div class="status-cnt" v-if="!ost.type.includes(10) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
                      {{ ost.useCnt < 0 ? ost.roundCnt : ost.useCnt }} </div>
                    </div>
                    <span>{{ ost.name }}</span>
                </span>
                <span>{{ isOutStatus[idx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isOutStatus[idx]" @click.stop="showRule(ost.description, ...outStatusExplain[idx].flat(2))">
                <div class="status-desc" v-for="(desc, didx) in ost.descriptions" :key="didx" v-html="desc"></div>
                <div v-if="outStatusExplain[idx].length > 0">
                  <div class="info-hero-status-explain" v-for="(expl, eidx) in outStatusExplain[idx]" :key="eidx">
                    <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="type == 6" @click.stop="showRule((info as Summonee).description)">
        <div class="name">{{ (info as Summonee).name }}</div>
        <div class="summon-desc" v-for="(desc, didx) in (info as Summonee).descriptions" :key="didx" v-html="desc">
        </div>
      </div>
    </div>
    <div class="info-container" :class="{ 'mobile-font': isMobile }" @click.stop=""
      v-if="isShow && type == 4 && ((info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot || (info as Hero).inStatus.length > 0 || (info as Hero).outStatus.length > 0)">
      <div class="info-equipment"
        v-if="(info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot">
        <div class="title">- 角色装备 -</div>
        <div class="equipment"
          v-for="(slot, slidx) in [(info as Hero).weaponSlot, (info as Hero).artifactSlot, (info as Hero).talentSlot].filter(s => s != null)"
          :key="slidx">
          <div class="equipment-title" @click.stop="showDesc(isEquipment, slidx)">
            <span class="equipment-title-left">
              <img
                :src="getIcon((slot as Card).subType.includes(0) ? 'weapon' : (slot as Card).subType.includes(1) ? 'artifact' : 'talent')" />
              <div class="status-cnt" v-if="(slot as Card).useCnt > -1">
                {{ Math.floor((slot as Card).useCnt) }}
                <!-- {{ (slot as Card).useCnt.toFixed(2) }} -->
              </div>
              <span>{{ (slot as Card).name }}</span>
            </span>
            <span>{{ isEquipment[slidx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isEquipment[slidx]"
            @click.stop="showRule((slot as Card).description, ...slotExplain[slidx].flat(2))">
            <div class="equipment-desc" v-for="(desc, didx) in (slot as Card).descriptions" :key="didx" v-html="desc">
            </div>
            <div v-if="slotExplain[slidx].length > 0">
              <div class="info-card-explain" v-for="(expl, eidx) in slotExplain[slidx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="(info as Hero).inStatus.length > 0" class="info-status">
        <div class="title">- 角色状态 -</div>
        <div v-for="(ist, idx) in (info as Hero).inStatus.filter(sts => !sts.type.includes(0))" :key="ist.id"
          class="status">
          <div class="status-title" @click.stop="showDesc(isInStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ist.iconBg }"></div>
                <img v-if="ist.icon != ''" :src="getPngIcon(ist.icon)"
                  :style="{ filter: ist.icon.startsWith('https') || ist.icon.startsWith('buff') || ist.icon.endsWith('dice') ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR.indexOf(ist.iconBg)})` : '' }" />
                <div v-else style="color: white;">{{ ist.name[0] }}</div>
                <div class="status-cnt" v-if="!ist.type.includes(10) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
                  {{ ist.useCnt < 0 ? ist.roundCnt : ist.useCnt }} </div>
                </div>
                <span>{{ ist.name }}</span>
            </span>
            <span>{{ isInStatus[idx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isInStatus[idx]" @click.stop="showRule(ist.description, ...inStatusExplain[idx].flat(2))">
            <div class="status-desc" v-for="(desc, didx) in ist.descriptions" :key="didx" v-html="desc"></div>
            <div v-if="inStatusExplain[idx].length > 0">
              <div class="info-hero-status-explain" v-for="(expl, eidx) in inStatusExplain[idx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="(info as Hero).outStatus.length > 0" class="info-status">
        <div class="title">- 阵营出战状态 -</div>
        <div v-for="(ost, idx) in (info as Hero).outStatus.filter(sts => !sts.type.includes(0))" :key="ost.id"
          class="status">
          <div class="status-title" @click.stop="showDesc(isOutStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ost.iconBg }"></div>
                <img v-if="ost.icon != ''" :src="getPngIcon(ost.icon)"
                  :style="{ filter: ost.icon.startsWith('https') || ost.icon.startsWith('buff') || ost.icon.endsWith('dice') ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR.indexOf(ost.iconBg)})` : '' }" />
                <div v-else style="color: white;">{{ ost.name[0] }}</div>
                <div class="status-cnt" v-if="!ost.type.includes(10) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
                  {{ ost.useCnt < 0 ? ost.roundCnt : ost.useCnt }} </div>
                </div>
                <span>{{ ost.name }}</span>
            </span>
            <span>{{ isOutStatus[idx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isOutStatus[idx]" @click.stop="showRule(ost.description, ...outStatusExplain[idx].flat(2))">
            <div class="status-desc" v-for="(desc, didx) in ost.descriptions" :key="didx" v-html="desc"></div>
            <div v-if="outStatusExplain[idx].length > 0">
              <div class="info-hero-status-explain" v-for="(expl, eidx) in outStatusExplain[idx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="info-container info-rule" :class="{ 'mobile-font': isMobile }"
      v-if="isShow && isShowRule && ruleExplain.length > 0">
      <div class="title">- 规则解释 -</div>
      <div class="rule-desc" v-for="(rule, ridx) in ruleExplain" :key="ridx" v-html="rule"></div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { ref, watchEffect } from 'vue';

import {
  ELEMENT, CARD_TYPE, CARD_SUBTYPE, ELEMENT_COLOR, SKILL_TYPE, CHANGE_GOOD_COLOR,
  WEAPON_TYPE, HERO_LOCAL, ELEMENT_ICON, STATUS_BG_COLOR, SKILL_TYPE_ABBR, RULE_EXPLAIN,
  CARD_SUBTYPE_URL, WEAPON_TYPE_URL, ELEMENT_URL, HERO_LOCAL_URL, CHANGE_BAD_COLOR,
} from '@/data/constant';

const props = defineProps(['info', 'isMobile']);

let infoObj = props.info;
const isMobile = ref<boolean>(props.isMobile);
const isShow = ref<boolean>(infoObj.isShow); // 是否显示
const type = ref<number>(infoObj.type); // 0-3技能idx 4角色 5卡牌 6召唤物
const info = ref<Hero | Card | Summonee | Site>(infoObj.info); // 展示信息
const skills = ref<Skill[]>([]); // 展示技能
const isShowSkill = ref<boolean[]>([]); // 是否展示技能
const isInStatus = ref<boolean[]>([]); // 是否展示角色状态
const isOutStatus = ref<boolean[]>([]); // 是否展示阵营出战状态
const isEquipment = ref<boolean[]>([]); // 是否展示装备
const skillExplain = ref<(string[][] | string[])[]>([]); // 技能解释
const inStatusExplain = ref<any[]>([]); // 状态技能解释
const outStatusExplain = ref<any[]>([]); // 状态技能解释
const slotExplain = ref<any[]>([]); // 装备解释
const ruleExplain = ref<any[]>([]); // 规则解释
const isShowRule = ref<boolean>(false); // 是否显示规则

const wrapedIcon = (idx: number, isDice = false) => {
  if ([-1, 8, 10].includes(idx)) return '';
  const url = idx < 8 ? isDice ? getPngIcon(ELEMENT_ICON[idx] + '-dice-bg') : ELEMENT_URL[idx] : getPngIcon(ELEMENT_ICON[idx]);
  return `<img style='width:18px;transform:translateY(20%);' src='${url}'/>`;
};
const wrapDesc = (desc: string, obj?: ExplainContent): string => {
  let res = desc.slice()
    .replace(/(?<!\\)【(.*?)】/g, "<span style='color:white;'>$1</span>")
    .replace(/(?<!\\)(｢)(.*?)(｣)/g, (_, prefix, word, suffix) => {
      let icon = '';
      const sbtpIdx = CARD_SUBTYPE.indexOf(word);
      const wpIdx = WEAPON_TYPE.indexOf(word);
      const lcIdx = HERO_LOCAL.indexOf(word);
      const iconUrl = sbtpIdx > -1 && !!CARD_SUBTYPE_URL[sbtpIdx] ? CARD_SUBTYPE_URL[sbtpIdx] : wpIdx > -1 ?
        WEAPON_TYPE_URL[wpIdx] : lcIdx > -1 && !!HERO_LOCAL_URL[lcIdx] ? HERO_LOCAL_URL[lcIdx] : '';
      if (iconUrl != '') {
        icon = `<img style='width:18px;transform:translateY(20%);${lcIdx > -1 ? `filter:url(${getSvgIcon('filter')}#status-color-0)` : ''}' src='${iconUrl}'/>`;
      }
      return `<span style='color:white;'>${prefix}${icon}${word}${suffix}</span>`;
    })
    .replace(/(?<!\\)‹(\d+)(.*?)›/g, (_, c, v) => `${wrapedIcon(c)}<span style='color:${ELEMENT_COLOR[c]};'>${v}</span>`)
    .replace(/(?<!\\)(\*?)\[(.*?)\]/g, (_, isUnderline, ctt) => {
      const el = ELEMENT.findIndex((v, vi) => v != '' && ((vi < 11 && ctt.includes(v)) || (vi > 11 && ctt == v)));
      const c = el > 10 || el == -1 ? 'white' : ELEMENT_COLOR[el];
      const wpicon = wrapedIcon(el, ctt.includes('骰'));
      const underline = isUnderline == '' ? `border-bottom:2px solid ${c};cursor:pointer;` : '';
      return `${wpicon}<span style='color:${c};${underline}margin-right:2px;${[-1, 8, 10].includes(el) ? 'margin-left:2px;' : ''}'>${ctt}</span>`;
    })
    .replace(/\\/g, '');
  if (obj) {
    if ('dmgChange' in obj) { // Skill
      const isChange = obj.dmgChange > 0;
      const dmg = Number(res.match(/{dmg\+?(\d*)}/)?.[1]) || 0;
      res = res.replace(/{dmg\+?\d*}/g, `${isChange ? `<span style='color:${CHANGE_GOOD_COLOR};'>` : ''}${Math.abs(obj.damage + obj.dmgChange + dmg)}${isChange ? '</span>' : ''}`);
    }
    if ('damage' in obj) { // Summonee | Skill
      const dmg = Number(res.match(/{dmg\+?(\d*)}/)?.[1]) || 0;
      res = res.replace(/{dmg\+?\d*}/g, `${Math.abs(obj.damage + dmg)}`);
    }
    if ('useCnt' in obj) res = res.replace('{useCnt}', `${obj.useCnt}`);
    if ('roundCnt' in obj) res = res.replace('{roundCnt}', `${obj.roundCnt}`); // Status
    if ('shield' in obj) { // Summonee
      res = res.replace('{shield}', `${Math.abs(obj.shield)}`).replace('{heal}', `${obj.shield}`);
    }
  }
  return res;
};
// 变白色：【】｢｣
// 下划线（有规则解释，如果可能前面会有图标）：[]
// 有某些特殊颜色（如 冰/水/火/雷）：‹nxxx› n为字体元素颜色 + 前面的图标 xxx为内容
// 一些参考括号类型｢｣﹝﹞«»‹›〔〕〖〗『』〈〉《》【】[]｢｣

const wrapExpl = (expls: ExplainContent[]): string[][] => {
  const container: string[][] = [];
  for (const expl of expls) {
    const explains: string[] = [];
    explains.push(`<span style='font-weight:bold;color:white;'>${expl.name}</span>`);
    explains.push(...expl.description.split('；').map(desc => wrapDesc(desc, expl)));
    container.push(explains);
  }
  return container;
};

const wrapRule = (...desc: string[]) => {
  ruleExplain.value = [];
  [...new Set(desc.join('').replace(/\>/g, '[').replace(/\</g, ']').match(/(?<=\[).*?(?=\])/g))].forEach(title => {
    if (title in RULE_EXPLAIN) {
      ruleExplain.value.push(`<div style='font-weight:bold;border-top: 2px solid #6f84a0;padding-top:5px;'>${wrapDesc(`*[${title}]`)}</div>`);
      ruleExplain.value.push(...RULE_EXPLAIN[title].split('；').map(desc => wrapDesc(desc)));
    }
  });
};

// 获取骰子背景
const getDiceIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
  return new URL(`/src/assets/image/${name}-dice-bg.png`, import.meta.url).href;
};

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http')) return name;
  if (name.endsWith('-dice')) return getSvgIcon(name);
  if (name == 'energy') name += '-dice-bg';
  return `/image/${name}.png`;
  return new URL(`/src/assets/image/${name}.png`, import.meta.url).href;
};

// 获取svg filter
const getSvgIcon = (name: string) => {
  return `/svg/${name}.svg`;
  return new URL(`/src/assets/svg/${name}.svg`, import.meta.url).href;
};

watchEffect(() => {
  infoObj = props.info;
  isMobile.value = props.isMobile;
  isShow.value = infoObj.isShow;
  type.value = infoObj.type;
  info.value = infoObj.info;
  ruleExplain.value = [];
  if (info.value && 'costType' in info.value) {
    info.value.descriptions = info.value.description.split('；').map(desc => wrapDesc(desc));
    skillExplain.value = wrapExpl(info.value.explains);
  }
  if (info.value && 'card' in info.value) {
    info.value.card.descriptions = info.value.card.description.split('；').map(desc => wrapDesc(desc));
  }
  if (info.value && 'inStatus' in info.value) {
    inStatusExplain.value = [];
    outStatusExplain.value = [];
    info.value.inStatus.forEach(ist => {
      ist.descriptions = ist.description.split('；').map(desc => wrapDesc(desc, ist));
      inStatusExplain.value.push(wrapExpl(ist.explains));
    });
    info.value.outStatus.forEach(ost => {
      ost.descriptions = ost.description.split('；').map(desc => wrapDesc(desc, ost));
      outStatusExplain.value.push(wrapExpl(ost.explains));
    });
    slotExplain.value = [];
    [info.value.weaponSlot, info.value.artifactSlot, info.value.talentSlot].forEach(slot => {
      if (slot != null) {
        const desc = slot.description.split('；').map(desc => wrapDesc(desc));
        const isActionTalent = [6, 7].every(v => slot.subType.includes(v));
        slot.descriptions = isActionTalent ? desc.slice(2) : desc;
        const onceDesc = slot.descriptions.findIndex(v => v.includes('入场时：'));
        if (onceDesc > -1) slot.descriptions.splice(onceDesc, 1);
        slotExplain.value.push(wrapExpl(slot.explains).slice(isActionTalent ? 1 : 0));
      }
    });
    skills.value = [];
    isShowSkill.value = [];
    skillExplain.value = [];
    const isSKill = type.value < 4;
    for (const skill of info.value.skills) {
      skills.value.push(skill);
      isShowSkill.value.push(isSKill);
    }
    skills.value.forEach(skill => {
      skill.descriptions = skill.description.split('；').map(desc => wrapDesc(desc, skill));
      skillExplain.value.push(wrapExpl(skill.explains));
    });
    isInStatus.value = new Array(info.value.inStatus.length).fill(false);
    isOutStatus.value = new Array(info.value.outStatus.length).fill(false);
    isEquipment.value = new Array([info.value.weaponSlot, info.value.artifactSlot, info.value.talentSlot].filter(s => s != null).length).fill(false);
  }
  if (info.value && 'isDestroy' in info.value) {
    info.value.descriptions = (info.value.description as string).split('；').map(desc => wrapDesc(desc, info.value as Summonee));
  }
});

// 获取图片
const getIcon = (name: string) => {
  return `/svg/${name}.svg`;
  return new URL(`/src/assets/svg/${name}.svg`, import.meta.url).href;
};

// 是否显示描述
const showDesc = (obj: boolean[], sidx: number) => {
  isShowRule.value = false;
  obj[sidx] = !obj[sidx];
};

// 是否显示规则
const showRule = (...desc: string[]) => {
  isShowRule.value = !isShowRule.value;
  if (isShowRule.value) wrapRule(...desc);
};
</script>

<style scoped>
.info-outer-container {
  position: absolute;
  top: 40px;
  left: 20px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  user-select: none;
  pointer-events: none;
}

.info-container {
  position: relative;
  width: 25vw;
  max-height: 50vh;
  border: 2px solid black;
  border-radius: 10px;
  background-color: #3e4d69e7;
  padding: 10px 5px;
  margin-right: 2px;
  overflow: auto;
  pointer-events: all;
}

.name {
  font-weight: bolder;
  margin-bottom: 3px;
  color: #93aed4;
  padding-left: 3px;
}

.info-card-cost {
  position: relative;
  width: 20px;
  height: 20px;
  margin-bottom: 5px;
  line-height: 20px;
  color: white;
  font-weight: bolder;
  font-size: medium;
  display: inline-block;
  -webkit-text-stroke: 1px black;
}

.cost-img {
  position: absolute;
  width: 25px;
  height: 25px;
}

.info-card-cost>span {
  position: absolute;
  left: 8px;
  top: 3px;
}

.info-card-energy {
  position: relative;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  margin-bottom: 5px;
  margin-left: -5px;
  font-size: medium;
  color: white;
  font-weight: bolder;
  display: inline-block;
  -webkit-text-stroke: 1px black;
}

.info-card-energy>span {
  position: absolute;
  left: 18px;
  top: 3px;
}

.info-card-type {
  display: inline-block;
  border: 2px solid black;
  border-radius: 5px;
  background-color: #898989dd;
  padding: 0 5px;
  margin-bottom: 3px;
}

.info-card-type.sub {
  background-color: #5787dfdd;
  margin-left: 3px;
}

.info-hero-tag {
  margin: 5px 0;
  display: flex;
  flex-wrap: wrap;
}

.info-hero-tag>span {
  border: 2px solid black;
  border-radius: 5px;
  margin: 1px;
  padding: 0 3px;
  background-color: #5786dfdd;
}

.info-hero-skill,
.info-status>.status,
.info-equipment>.equipment {
  border: 2px solid black;
  margin-top: 3px;
  transition: 1s;
  border-radius: 4px;
}

.info-hero-skill-title,
.status-title,
.equipment-title {
  border: 2px solid black;
  margin: 1px;
  padding: 1px 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  color: #bdd5ff;
  background: #272f3be7;
}

.equipment-title-left,
.status-title-left {
  position: relative;
  display: flex;
  align-items: center;
  height: 25px;
}

.equipment-title-left>img {
  width: 25px;
  height: 25px;
  border: 2px solid #525252;
  border-radius: 50%;
  background: #d2d493;
  margin-right: 3px;
}

.status-icon {
  position: relative;
  width: 25px;
  height: 25px;
  margin: 2px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.status-icon>img {
  width: 100%;
  border-radius: 50%;
}

.status-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90%;
  height: 90%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.25;
}

.status-cnt {
  position: absolute;
  left: 15px;
  bottom: 0;
  font-size: 12px;
  height: 12px;
  width: 12px;
  line-height: 12px;
  text-align: center;
  color: white;
  background: #000000ae;
  border-radius: 50%;
}

.info-hero-skill-desc,
.info-card-desc,
.status-desc,
.summon-desc,
.equipment-desc,
.rule-desc {
  color: #c8c8c8;
  margin: 2px;
  padding: 3px;
}

.info-hero-skill-explain,
.info-hero-status-explain,
.info-card-explain {
  margin: 3px;
  margin-right: 0;
  margin-top: 5px;
  padding: 3px;
  padding-top: 0;
  font-size: smaller;
  border-left: 3px #8f8f8f solid;
  box-sizing: border-box;
  color: #c8c8c8;
}

.skill-img {
  width: 35px;
  height: 35px;
  margin-right: 5px;
}

.info-skill-costs {
  display: flex;
  flex-direction: column;
}

.skill-type {
  color: #bfba83;
  font-weight: bold;
}

.skill-cost {
  width: 17px;
  height: 17px;
  margin: 0 2px;
  margin-top: 5px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: bolder;
  -webkit-text-stroke: 1px black;
}

.skill-cost>.cost-img {
  position: absolute;
  width: 20px;
  height: 20px;
}

.skill-cost>span {
  position: absolute;
}

.info-status,
.info-equipment {
  margin-top: 2px;
}

.info-status>.title,
.info-equipment>.title,
.info-rule>.title {
  text-align: center;
  font-weight: bold;
  color: #93aed4;
}

.mobile-font {
  font-size: small;
}

svg {
  display: none;
}

::-webkit-scrollbar {
  width: 5px;
  height: 5px;
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background: #335c99d0;
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>