package com.valeo.kanban.service.workflow;

import java.util.List;

/**
 * The stages and rules every new board starts with, so a board is guarded from the moment it exists.
 * Mirrors the demo board seeded in data.sql. Project Managers can change the rules afterwards.
 */
public final class DefaultWorkflow {

    /** A permitted move between two stages, named by column. */
    public record Rule(String from, String to, String fallback, boolean requiresApproval) {}

    public static final String TODO = "To-Do";
    public static final String IN_PROGRESS = "In Progress";
    public static final String CODE_REVIEW = "Code Review";
    public static final String READY_FOR_QA = "Ready for QA";
    public static final String DONE = "Done";

    /** Column names, left to right. */
    public static final List<String> COLUMNS = List.of(TODO, IN_PROGRESS, CODE_REVIEW, READY_FOR_QA, DONE);

    public static final List<Rule> RULES = List.of(
            new Rule(TODO, IN_PROGRESS, null, false),
            new Rule(IN_PROGRESS, CODE_REVIEW, null, false),
            // Both gates send a rejected card back to In Progress
            new Rule(CODE_REVIEW, READY_FOR_QA, IN_PROGRESS, true),
            new Rule(READY_FOR_QA, DONE, IN_PROGRESS, true),
            // QA hands a card straight back without waiting for approval
            new Rule(READY_FOR_QA, IN_PROGRESS, null, false)
    );

    private DefaultWorkflow() {
    }
}
