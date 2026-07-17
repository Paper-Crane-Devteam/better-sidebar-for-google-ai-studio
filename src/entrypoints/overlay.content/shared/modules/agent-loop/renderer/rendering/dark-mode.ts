/**
 * Dark mode synchronization for shadow DOM roots.
 */

export function syncDarkMode(root: HTMLElement): void {
  const applyDark = () => {
    const themeValue = localStorage.getItem('Bard-Color-Theme');
    const isDark = themeValue
      ? themeValue === 'Bard-Dark-Theme'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', isDark);
  };
  applyDark();
  window.addEventListener('storage', (e) => {
    if (e.key === 'Bard-Color-Theme') applyDark();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDark);
}
