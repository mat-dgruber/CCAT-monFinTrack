import { Component, ElementRef, ViewChild, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ChartModule } from 'primeng/chart';

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
    chartData?: any; // Optional chart config
}

import { Router } from '@angular/router';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, ChartModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
    private aiService = inject(AIService);
    private router = inject(Router);
    subscriptionService = inject(SubscriptionService);
    canAccess = computed(() => this.subscriptionService.canAccess('chat'));

    expanded = signal(false);
    messages = signal<ChatMessage[]>([]);
    loading = signal(false);
    isRoastMode = signal(false);
    currentMessage = '';

    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    constructor() {
        // Auto-scroll logic could go here in an effect, or just manual in settimeout
    }

    navigateToPricing() {
        this.router.navigate(['/pricing']);
    }
// ... rest of class


    toggleChat() {
        this.expanded.update(v => !v);
        // Focus input logic if desired
    }

    toggleRoastMode() {
        if (!this.subscriptionService.canAccess('roast_mode')) return;
        this.isRoastMode.update(v => !v);
    }

    sendMessage() {
        if (!this.currentMessage.trim() || this.loading()) return;

        const userMsg = this.currentMessage.trim();
        const persona = this.isRoastMode() ? 'roast' : 'friendly';

        this.addMessage('user', userMsg);
        this.currentMessage = '';
        this.loading.set(true);
        this.scrollToBottom();

        this.aiService.sendMessage(userMsg, persona).subscribe({
            next: (res) => {
                const { text, chart } = this.parseResponse(res.response);
                this.addMessage('ai', text, chart);
                this.loading.set(false);
                this.scrollToBottom();
            },
            error: (err) => {
                console.error(err);
                this.addMessage('ai', 'Desculpe, não consegui conectar ao cérebro financeiro agora. 🧠💥');
                this.loading.set(false);
                this.scrollToBottom();
            }
        });
    }

    private parseResponse(raw: string): { text: string, chart?: any } {
        // Look for JSON block ```json ... ```
        const jsonMatch = raw.match(/```json\s*(\{[\s\S]*?\})\s*```/);

        if (jsonMatch && jsonMatch[1]) {
            try {
                const chartJson = JSON.parse(jsonMatch[1]);
                if (chartJson.type === 'chart') {
                    // Normalize for PrimeNG Chart
                    const chartData = {
                         labels: chartJson.data.labels,
                         datasets: [
                             {
                                 data: chartJson.data.values,
                                 backgroundColor: [
                                     "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40"
                                 ],
                                 hoverBackgroundColor: [
                                     "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40"
                                 ]
                             }
                         ]
                    };

                    const chartOptions = {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                            },
                            title: {
                                display: true,
                                text: chartJson.title || 'Gráfico'
                            }
                        }
                    };

                    return {
                        text: raw.replace(jsonMatch[0], '').trim(), // Remove JSON from text
                        chart: {
                            type: chartJson.chartType || 'pie',
                            data: chartData,
                            options: chartOptions
                        }
                    };
                }
            } catch (e) {
                console.error('Failed to parse Chart JSON', e);
            }
        }
        return { text: raw };
    }

    private addMessage(sender: 'user' | 'ai', text: string, chart: any = null) {
        this.messages.update(msgs => [...msgs, {
            sender,
            text,
            timestamp: new Date(),
            chartData: chart
        }]);
    }

    private scrollToBottom() {
        setTimeout(() => {
            if (this.scrollContainer) {
                this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
            }
        }, 100);
    }
}
