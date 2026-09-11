package com.valeo.kanban.security;

import java.util.Set;

/** The boards of one workspace a user may open: all of them, or an explicit set. */
public record BoardScope(boolean allBoards, Set<Long> boardIds) {

    public static final BoardScope ALL = new BoardScope(true, Set.of());
    public static final BoardScope NONE = new BoardScope(false, Set.of());

    public static BoardScope of(Set<Long> boardIds) {
        return new BoardScope(false, Set.copyOf(boardIds));
    }

    public boolean includes(Long boardId) {
        return allBoards || boardIds.contains(boardId);
    }
}
