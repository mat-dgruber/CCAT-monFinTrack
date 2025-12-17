import { Component, ElementRef, ViewChild, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AIService } from '../../services/ai.service';
import { SubscriptionService } from '../../services/subscription.service';

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
    private aiService = inject(AIService);
    subscriptionService = inject(SubscriptionService);

    expanded = signal(false);
    messages = signal<ChatMessage[]>([]);
    loading = signal(false);
    isRoastMode = signal(false);
    currentMessage = '';

    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    constructor() {
        // Auto-scroll logic could go here in an effect, or just manual in settimeout
    }

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
                this.addMessage('ai', res.response);
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

    private addMessage(sender: 'user' | 'ai', text: string) {
        this.messages.update(msgs => [...msgs, {
            sender,
            text,
            timestamp: new Date()
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
