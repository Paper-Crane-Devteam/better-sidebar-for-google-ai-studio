import React, { useState } from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import {
  Sparkles,
  Palette,
  ShoppingCart,
  Check,
  Loader2,
  ExternalLink,
  KeyRound,
  Infinity,
  Monitor,
  Wand2,
  Zap,
  Bot,
  DatabaseZap,
  Clock,
  Share2,
  Crown,
} from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useLicenseStore, isLicenseValid, type LicenseTier } from '@/shared/lib/license-store';
import { activateLicense, identifyTokenSource } from '@/shared/lib/license-api';
import { openPurchasePage, getPurchaseLinks } from '@/shared/lib/license-links';

export const SupportPackSettings = () => {
  const { t } = useI18n();
  const licenseState = useLicenseStore();
  const hasLicense = isLicenseValid(licenseState);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          {t('packs.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('packs.subtitle')}
        </p>
        <Separator />
      </div>

      {hasLicense ? (
        <ActivatedView t={t} tier={licenseState.tier} />
      ) : (
        <PurchaseView t={t} />
      )}
    </div>
  );
};

/** View shown when the user already has an active license */
function ActivatedView({ t, tier }: { t: (key: string) => string; tier: LicenseTier }) {
  const { token, deactivate } = useLicenseStore();

  const tierLabel = tier === 'pro' ? 'Pro' : tier === 'power_pack' ? 'Power Pack' : 'Support Pack';
  const isPowerOrPro = tier === 'power_pack' || tier === 'pro';

  return (
    <div className="space-y-6">
      {/* Success card */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-primary">
              {tierLabel} {t('packs.active')}
            </p>
            <p className="text-xs text-muted-foreground">
              {token?.slice(0, 12)}...
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {isPowerOrPro
            ? t('packs.activatedDescriptionPower')
            : t('packs.activatedDescriptionSupport')}
        </p>
      </div>

      {/* If only support pack, show upgrade prompt */}
      {tier === 'support_pack' && (
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('packs.upgradePrompt')}</p>
              <p className="text-xs text-muted-foreground">{t('packs.upgradePromptDesc')}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5"
                onClick={() => openPurchasePage()}
              >
                <Zap className="h-3.5 w-3.5" />
                {t('packs.upgradeToPower')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={deactivate}
        >
          {t('supportPack.deactivate')}
        </Button>
      </div>
    </div>
  );
}

/** View shown when the user hasn't purchased yet */
function PurchaseView({ t }: { t: (key: string) => string }) {
  const links = getPurchaseLinks();

  return (
    <div className="space-y-6">
      {/* Two-pack layout */}
      <div className="grid gap-4">
        {/* Support Pack Card */}
        <div className="rounded-xl border bg-accent/20 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Palette className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('packs.supportPackTitle')}</h4>
              <p className="text-xs text-muted-foreground">{t('packs.supportPackTagline')}</p>
            </div>
          </div>
          <div className="space-y-2 ml-0.5">
            <FeatureItem
              icon={<Palette className="h-3.5 w-3.5 text-primary" />}
              text={t('packs.spFeature1')}
            />
            <FeatureItem
              icon={<Infinity className="h-3.5 w-3.5 text-primary" />}
              text={t('packs.spFeature2')}
            />
            <FeatureItem
              icon={<Wand2 className="h-3.5 w-3.5 text-primary" />}
              text={t('packs.spFeature3')}
            />
            <FeatureItem
              icon={<Monitor className="h-3.5 w-3.5 text-primary" />}
              text={t('packs.spFeature4')}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 gap-2"
            onClick={() => openPurchasePage()}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {t('packs.getSupportPack')}
          </Button>
        </div>

        {/* Power Pack Card — featured/highlighted with bold gradient */}
        <div className="rounded-xl border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 p-5 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl pointer-events-none" />

          {/* Popular badge */}
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/30">
              <Zap className="h-2.5 w-2.5" />
              {t('packs.popular')}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mb-3 relative">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/25 to-purple-500/25 flex items-center justify-center ring-1 ring-violet-500/20">
              <Zap className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('packs.powerPackTitle')}</h4>
              <p className="text-xs text-muted-foreground">{t('packs.powerPackTagline')}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3 relative">
            {t('packs.powerPackDescription')}
          </p>
          <div className="space-y-2 ml-0.5 relative">
            <FeatureItem
              icon={<Palette className="h-3.5 w-3.5 text-violet-500" />}
              text={t('packs.ppFeatureThemes')}
            />
            <FeatureItem
              icon={<Bot className="h-3.5 w-3.5 text-violet-500" />}
              text={t('packs.ppFeatureAgent')}
            />
            <FeatureItem
              icon={<DatabaseZap className="h-3.5 w-3.5 text-violet-500" />}
              text={t('packs.ppFeatureWrite')}
            />
            <FeatureItem
              icon={<Clock className="h-3.5 w-3.5 text-violet-500" />}
              text={t('packs.ppFeatureHistory')}
            />
            <FeatureItem
              icon={<Share2 className="h-3.5 w-3.5 text-violet-500" />}
              text={t('packs.ppFeatureExport')}
            />
          </div>
          <Button
            className="w-full mt-4 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md shadow-violet-500/20 border-0"
            onClick={() => openPurchasePage()}
          >
            <Zap className="h-3.5 w-3.5" />
            {t('packs.getPowerPack')}
          </Button>
        </div>
      </div>

      {/* Platform switcher */}
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>{t('supportPack.otherPlatform')}</span>
        <button
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={() => window.open(links.gumroad, '_blank')}
        >
          Gumroad
          <ExternalLink className="h-3 w-3" />
        </button>
        <span>|</span>
        <button
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={() => window.open(links.afdian, '_blank')}
        >
          {t('supportPack.afdian')}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      <Separator />

      {/* Token activation section */}
      <ActivationInput t={t} />
    </div>
  );
}

/** Token input and activation form */
function ActivationInput({ t }: { t: (key: string) => string }) {
  const { deviceId, activate } = useLicenseStore();
  const [inputToken, setInputToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    const trimmed = inputToken.trim();
    if (!trimmed) return;

    const source = identifyTokenSource(trimmed);
    if (source === 'unknown') {
      setError(t('supportPack.invalidToken'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await activateLicense(trimmed, deviceId);

    setLoading(false);

    if (result.success) {
      activate(trimmed, result.signedPayload, result.expiresAt, result.tier);
      setSuccess(true);
      setInputToken('');
    } else {
      const errorMsg =
        result.error === 'network_error'
          ? t('supportPack.networkError')
          : result.error === 'max_devices_reached'
            ? t('supportPack.maxDevices')
            : t('supportPack.activationFailed');
      setError(errorMsg);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">{t('supportPack.alreadyPurchased')}</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('supportPack.enterToken')}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputToken}
          onChange={(e) => {
            setInputToken(e.target.value.toUpperCase());
            setError(null);
            setSuccess(false);
          }}
          placeholder={t('supportPack.tokenPlaceholder')}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleActivate();
          }}
        />
        <Button
          size="sm"
          className="h-9 px-4"
          onClick={handleActivate}
          disabled={loading || !inputToken.trim()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t('supportPack.activate')
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {success && (
        <p className="text-xs text-primary flex items-center gap-1">
          <Check className="h-3 w-3" />
          {t('supportPack.activationSuccess')}
        </p>
      )}
    </div>
  );
}

/** A single feature bullet point */
function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div className="shrink-0">{icon}</div>
      <span className="text-xs">{text}</span>
    </div>
  );
}
