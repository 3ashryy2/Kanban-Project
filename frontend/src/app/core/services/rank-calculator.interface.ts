import { InjectionToken } from '@angular/core';
import { TaskDto } from '../models/task.dto';

export interface IRankCalculator {
  calculateNewPosition(targetTasks: TaskDto[], targetIndex: number): number;
}

export const RANK_CALCULATOR_TOKEN = new InjectionToken<IRankCalculator>('RankCalculator');
