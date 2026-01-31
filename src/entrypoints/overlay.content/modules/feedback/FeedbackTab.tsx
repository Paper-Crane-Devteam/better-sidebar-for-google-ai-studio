import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Send } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { toast } from '@/shared/lib/toast';
import { useI18n } from '@/shared/hooks/useI18n';

// Constants for EmailJS - Loaded from environment variables
// Ensure these are set in your .env file (VITE_EMAILJS_SERVICE_ID, etc.)
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_WIDTH = 800; // Resize screenshot to max 800px width

export const FeedbackTab = () => {
    const { t } = useI18n();
    const [isLoading, setIsLoading] = useState(false);
    // const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });

    // System Info
    const [systemInfo, setSystemInfo] = useState({
        extensionVersion: '',
        userAgent: '',
        platform: '',
        currentUrl: '',
        screenSize: '',
    });

    useEffect(() => {
        // Gather System Information
        const getSystemInfo = async () => {
            let version = 'Unknown';
            let currentUrl = 'Unknown';

            try {
                const manifest = browser.runtime.getManifest();
                version = manifest.version;
            } catch (e) {
                console.warn('Failed to get manifest version', e);
            }

            try {
              // Since this component is used in overlay.content (content script),
              // window.location.href is the page URL.
              currentUrl = window.location.href;
            } catch (e) {
                console.warn('Failed to get current url', e);
                currentUrl = 'Unknown';
            }
            
            setSystemInfo({
                extensionVersion: version,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                currentUrl: currentUrl,
                screenSize: `${window.screen.width}x${window.screen.height}`
            });
        };
        getSystemInfo();
    }, []);

    /*
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    */

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.message) {
            return;
        }

        // Rate limiting check
        const lastFeedbackTime = localStorage.getItem('last_feedback_time');
        if (lastFeedbackTime) {
            const timeDiff = Date.now() - parseInt(lastFeedbackTime);
            // 2 minutes cooldown
            if (timeDiff < 2 * 60 * 1000) {
                toast.error(t('toast.feedbackRateLimit'));
                return;
            }
        }

        setIsLoading(true);
        // setStatus('idle');

        // Prepare data package
        const templateParams = {
            from_name: formData.name || 'Anonymous',
            from_email: formData.email || 'Not provided',
            message: formData.message,
            ...systemInfo,
            // screenshot: screenshot ? 'Attached (Base64)' : 'None',
            // screenshot_data: screenshot || '' 
        };

        console.log('Sending Feedback:', templateParams);

        try {
            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

            // setStatus('success');
            setFormData({ name: '', email: '', message: '' });
            localStorage.setItem('last_feedback_time', Date.now().toString());
            // setScreenshot(null);
            
            // Show toast/message immediately
            toast.success(t('toast.feedbackSent'));
            
            // Clear status after 3 seconds
            // setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error('Failed to send feedback:', error);
            // setStatus('error');
            toast.error(t('toast.feedbackFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between h-12 shrink-0">
                <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {t('tabs.feedback')}
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold">{t('feedback.sendFeedback')}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t('feedback.description')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {t('feedback.name')} <span className="text-muted-foreground font-normal">({t('feedback.nameOptional')})</span>
                            </label>
                            <Input
                                placeholder={t('feedback.namePlaceholder')}
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                disabled={isLoading}
                                maxLength={50}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {t('feedback.email')} <span className="text-muted-foreground font-normal">({t('feedback.emailOptional')})</span>
                            </label>
                            <Input
                                type="email"
                                placeholder={t('feedback.emailPlaceholder')}
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                disabled={isLoading}
                                maxLength={100}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {t('feedback.message')} <span className="text-red-500">{t('feedback.messageRequired')}</span>
                            </label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                placeholder={t('feedback.messagePlaceholder')}
                                value={formData.message}
                                maxLength={MAX_MESSAGE_LENGTH}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                                        setFormData(prev => ({ ...prev, message: e.target.value }));
                                    }
                                }}
                                disabled={isLoading}
                                required
                            />
                            <div className="text-xs text-right text-muted-foreground">
                                {formData.message.length}/{MAX_MESSAGE_LENGTH}
                            </div>
                        </div>
                        
                        {/* Hidden System Info Preview (for debugging/transparency) */}
                        {/* <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                            <p>System Info will be included:</p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li>Version: {systemInfo.extensionVersion}</li>
                                <li>OS: {systemInfo.platform}</li>
                                <li>Browser: {systemInfo.userAgent.substring(0, 30)}...</li>
                                <li>Screen: {systemInfo.screenSize}</li>
                            </ul>
                        </div> */}

                        <Button type="submit" className="w-full" disabled={isLoading || !formData.message}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('feedback.sending')}
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    {t('feedback.sendFeedbackButton')}
                                </>
                            )}
                        </Button>

                        {/* 
                        {status === 'success' && (
                            <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800 text-center">
                                Thank you for your feedback!
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 text-center">
                                Failed to send feedback. Please try again later.
                            </div>
                        )}
                        */}
                    </form>
                </div>
            </div>
        </div>
    );
};
