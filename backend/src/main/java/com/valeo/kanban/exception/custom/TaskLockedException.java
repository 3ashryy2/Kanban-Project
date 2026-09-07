package com.valeo.kanban.exception.custom;

public class TaskLockedException extends RuntimeException {
    public TaskLockedException(String message) {
        super(message);
    }
}
