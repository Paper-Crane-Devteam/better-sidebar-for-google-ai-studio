import React from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import { Heart, Coffee, Star } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';

export const SponsorSettings = () => {
    const { t, currentLanguage } = useI18n();

    const handleSponsorClick = () => {
        window.open(
          'https://github.com/Paper-Crane-Devteam/better-sidebar-for-google-ai-studio',
          '_blank',
        );
    };

    const handleCoffeeClick = () => {
        if (currentLanguage === 'zh-CN') {
            window.open('https://afdian.com/a/papercranedev', '_blank');
        } else {
            window.open('https://ko-fi.com/papercranedev57397', '_blank');
        }
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
                            {t('sponsor.description')}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <Button 
                            variant="outline"
                            className="w-full gap-2"
                            onClick={handleSponsorClick}
                        >
                            <Star className="h-4 w-4" />
                            {t('sponsor.sponsorOnGithub')}
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full gap-2 border-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400"
                            onClick={handleCoffeeClick}
                        >
                            <Coffee className="h-4 w-4" />
                            {t('sponsor.buyMeACoffee')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
