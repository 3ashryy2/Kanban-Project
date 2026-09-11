package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.BoardCreateRequest;
import com.valeo.kanban.dto.response.BoardDetailsDto;
import com.valeo.kanban.dto.mapper.BoardMapper;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.BoardMember;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.repository.WorkspaceRepository;
import com.valeo.kanban.security.BoardAccessService;
import com.valeo.kanban.security.BoardScope;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BoardService {

    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final ColumnRepository columnRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final BoardMemberRepository boardMemberRepository;
    private final BoardAccessService boardAccessService;

    @Transactional(readOnly = true)
    public BoardDetailsDto getBoardAggregate(Long boardId) {
        // Query 1: Fetch Board and its Columns
        Board board = boardRepository.findBoardWithColumnsById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        // Query 2: Fetch all tasks belonging to the board
        List<Task> tasks = taskRepository.findAllByBoardIdOrderByPositionAsc(boardId);

        // Assembly into aggregate DTO in application memory (Two-Query pattern)
        return BoardMapper.toAggregateDto(board, tasks);
    }

    @Transactional(readOnly = true)
    public List<BoardDetailsDto> getWorkspaceBoards(Long workspaceId, CustomUserDetails currentUser) {
        // Members only see the boards they belong to; Admins and PMs see them all
        BoardScope scope = boardAccessService.scopeFor(workspaceId, currentUser);
        return boardRepository.findAllByWorkspaceIdOrderByIdAsc(workspaceId).stream()
                .filter(board -> scope.includes(board.getId()))
                .map(BoardMapper::toSummaryDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public BoardDetailsDto createBoard(Long workspaceId, BoardCreateRequest request, CustomUserDetails currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        User creator = userRepository.getReferenceById(currentUser.getId());

        Board board = Board.builder()
                .workspace(workspace)
                .title(request.getTitle())
                .description(request.getDescription())
                .createdBy(creator)
                .build();

        Board savedBoard = boardRepository.save(board);

        // Create standard columns for instant Kanban setup
        List<Column> defaultColumns = Arrays.asList(
                Column.builder().board(savedBoard).name("To-Do").position(1000.0).isGated(false).build(),
                Column.builder().board(savedBoard).name("In Progress").position(2000.0).isGated(false).build(),
                Column.builder().board(savedBoard).name("Code Review").position(3000.0).isGated(false).build(),
                Column.builder().board(savedBoard).name("Ready for QA").position(4000.0).isGated(true).build(),
                Column.builder().board(savedBoard).name("Done").position(5000.0).isGated(false).build()
        );

        List<Column> savedColumns = columnRepository.saveAll(defaultColumns);
        savedColumns.forEach(savedBoard::addColumn);

        // A PM who creates a board becomes its explicit member, so a later demotion doesn't take it away.
        // The global admin has no workspace membership and needs none.
        if (workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, currentUser.getId())) {
            boardMemberRepository.save(BoardMember.builder()
                    .board(savedBoard)
                    .workspaceId(workspaceId)
                    .user(creator)
                    .addedBy(creator)
                    .build());
        }

        return BoardMapper.toAggregateDto(savedBoard, Collections.emptyList());
    }

    @Transactional
    public BoardDetailsDto updateBoard(Long boardId, BoardCreateRequest request) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        board.setTitle(request.getTitle());
        board.setDescription(request.getDescription());
        Board updatedBoard = boardRepository.save(board);

        List<Task> tasks = taskRepository.findAllByBoardIdOrderByPositionAsc(boardId);
        return BoardMapper.toAggregateDto(updatedBoard, tasks);
    }

    @Transactional
    public void deleteBoard(Long boardId) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));
        boardRepository.delete(board);
    }
}
