import { Injectable } from '@angular/core';
import { TaskDto } from '../models/task.dto';
import { IRankCalculator } from './rank-calculator.interface';

@Injectable({
  providedIn: 'root'
})
export class LexorankService implements IRankCalculator {
  private readonly DEFAULT_STEP = 1000.0;

  calculateNewPosition(targetColumnCards: TaskDto[], targetIndex: number): number {
    const count = targetColumnCards.length;

    // 1. Column is empty or dropped at the top
    if (count === 0) {
      return this.DEFAULT_STEP;
    }
    if (targetIndex === 0) {
      return targetColumnCards[0].position / 2.0;
    }

    // 2. Dropped at the bottom
    if (targetIndex >= count) {
      return targetColumnCards[count - 1].position + this.DEFAULT_STEP;
    }

    // 3. Dropped between two cards
    const prevPos = targetColumnCards[targetIndex - 1].position;
    const nextPos = targetColumnCards[targetIndex].position;
    return (prevPos + nextPos) / 2.0;
  }
}
