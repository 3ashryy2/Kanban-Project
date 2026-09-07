package com.valeo.kanban.exception.custom;

public class ConcurrencyConflictException extends RuntimeException {
    public ConcurrencyConflictException(String message) {
        super(message);
    }
}
