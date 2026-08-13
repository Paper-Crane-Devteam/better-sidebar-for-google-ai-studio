import React, { useState } from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import { Heart, Star, Share2, Link, Check } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { toast } from '@/shared/lib/toast';
import { getRandomShareCopy, isChinese, SHARE_URL } from '@/shared/share-copy';
import qrcodeImg from '@/assets/images/qrcode.png';

/** Twitter / X icon */
const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

/** Reddit icon */
const RedditIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
);

/** Weibo icon (Simple Icons) */
const WeiboIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
        <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z" />
    </svg>
);

/** Xiaohongshu icon (Simple Icons) */
const XiaohongshuIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
        <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" />
    </svg>
);

/** WeChat icon (Simple Icons) */
const WeChatIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
    </svg>
);

export const SponsorSettings = () => {
    const { t, currentLanguage } = useI18n();
    const [copied, setCopied] = useState(false);
    const [showQrcode, setShowQrcode] = useState(false);

    const isZh = isChinese(currentLanguage);

    const handleGithubClick = () => {
        window.open(
            'https://github.com/Paper-Crane-Devteam/better-sidebar-for-google-ai-studio',
            '_blank',
        );
    };

    const handleCopyLink = () => {
        const copy = getRandomShareCopy(currentLanguage);
        navigator.clipboard.writeText(`${copy}\n${SHARE_URL}`);
        setCopied(true);
        toast.success(t('sponsor.copied'), 1500);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTwitter = () => {
        const copy = getRandomShareCopy(currentLanguage);
        window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(copy)}&url=${encodeURIComponent(SHARE_URL)}`,
            '_blank',
        );
    };

    const handleReddit = () => {
        const copy = getRandomShareCopy(currentLanguage);
        window.open(
            `https://reddit.com/submit?url=${encodeURIComponent(SHARE_URL)}&title=${encodeURIComponent(copy)}`,
            '_blank',
        );
    };

    const handleEmail = () => {
        const copy = getRandomShareCopy(currentLanguage);
        window.open(
            `mailto:?subject=${encodeURIComponent('Better Sidebar for Gemini & AI Studio')}&body=${encodeURIComponent(`${copy}\n\n${SHARE_URL}`)}`,
            '_blank',
        );
    };

    const handleWeibo = () => {
        const copy = getRandomShareCopy(currentLanguage);
        window.open(
            `https://service.weibo.com/share/share.php?url=${encodeURIComponent(SHARE_URL)}&title=${encodeURIComponent(copy)}`,
            '_blank',
        );
    };

    const handleXiaohongshu = () => {
        const copy = getRandomShareCopy(currentLanguage);
        navigator.clipboard.writeText(`${copy}\n${SHARE_URL}`);
        toast.success(t('sponsor.xiaohongshuCopied'), 2000);
    };

    const handleWechat = () => {
        setShowQrcode(!showQrcode);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('sponsor.title')}</h3>
                <Separator />

                <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
                    <div className="relative">
                        <Heart className="h-16 w-16 text-red-500 animate-pulse" fill="currentColor" />
                        <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 animate-pulse" />
                    </div>

                    <div className="space-y-2 max-w-sm">
                        <h3 className="text-xl font-semibold">{t('sponsor.enjoying')}</h3>
                        <p className="text-muted-foreground">
                            {t('sponsor.shareDescription')}
                        </p>
                    </div>

                    {/* Share channels grid */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                        {isZh ? (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                                    onClick={handleWeibo}
                                >
                                    <WeiboIcon className="h-4 w-4" />
                                    <span className="text-xs">{t('sponsor.weibo')}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                                    onClick={handleXiaohongshu}
                                >
                                    <XiaohongshuIcon className="h-4 w-4" />
                                    <span className="text-xs">{t('sponsor.xiaohongshu')}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/50"
                                    onClick={handleWechat}
                                >
                                    <WeChatIcon className="h-4 w-4" />
                                    <span className="text-xs">{t('sponsor.wechat')}</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-foreground/10 hover:border-foreground/50"
                                    onClick={handleTwitter}
                                >
                                    <XIcon className="h-4 w-4" />
                                    <span className="text-xs">X</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500/50"
                                    onClick={handleReddit}
                                >
                                    <RedditIcon className="h-4 w-4" />
                                    <span className="text-xs">Reddit</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex flex-col gap-1 h-auto py-3 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/50"
                                    onClick={handleEmail}
                                >
                                    <Share2 className="h-4 w-4" />
                                    <span className="text-xs">Email</span>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* WeChat QR code expand area */}
                    {isZh && showQrcode && (
                        <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/40">
                            <img src={qrcodeImg} alt="WeChat QR Code" className="w-40 h-40" />
                            <p className="text-xs text-muted-foreground">{t('sponsor.wechatScan')}</p>
                        </div>
                    )}

                    {/* Copy link - always shown */}
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleCopyLink}
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                            {copied ? t('sponsor.copied') : t('sponsor.copyLink')}
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleGithubClick}
                        >
                            <Star className="h-4 w-4" />
                            {t('sponsor.sponsorOnGithub')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
