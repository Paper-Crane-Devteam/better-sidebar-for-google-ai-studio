import { shareCopyList as zhCN } from './zh-CN';
import { shareCopyList as en } from './en';

export const SHARE_URL = 'https://chromewebstore.google.com/detail/cjeoaidogoaekodkbhijgljhenknkenj';

/**
 * 根据语言获取一条随机分享文案
 */
export function getRandomShareCopy(language: string): string {
  const isChinese = language.startsWith('zh');
  const list = isChinese ? zhCN : en;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 判断是否中文用户
 */
export function isChinese(language: string): boolean {
  return language.startsWith('zh');
}
