package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.WorkspaceCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberCreateRequest;
import com.valeo.kanban.dto.response.WorkspaceMemberResponseDto;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.dto.mapper.WorkspaceMapper;
import com.valeo.kanban.dto.mapper.WorkspaceMemberMapper;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.repository.WorkspaceRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.valeo.kanban.dto.request.WorkspaceMemberUpdateRequest;
import org.springframework.security.access.AccessDeniedException;
import com.valeo.kanban.dto.response.WorkspaceCountProjection;
import java.util.Collections;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final BoardRepository boardRepository;

    @Transactional(readOnly = true)
    public List<WorkspaceResponseDto> getUserWorkspaces(CustomUserDetails currentUser) {
        // Fetch memberships with workspace in one query (Phase 4 / Issue 6)
        List<WorkspaceMember> memberships = workspaceMemberRepository.findAllByUserIdWithWorkspace(currentUser.getId());

        // Extract workspace IDs with safety guard
        List<Long> workspaceIds = memberships.stream()
                .map(m -> m.getWorkspace().getId())
                .collect(Collectors.toList());

        if (workspaceIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        // Two aggregate count queries (not N queries)
        Map<Long, Long> boardCounts = boardRepository.countByWorkspaceIds(workspaceIds).stream()
                .collect(Collectors.toMap(
                        WorkspaceCountProjection::getWorkspaceId,
                        WorkspaceCountProjection::getCount
                ));

        Map<Long, Long> memberCounts = workspaceMemberRepository.countByWorkspaceIds(workspaceIds).stream()
                .collect(Collectors.toMap(
                        WorkspaceCountProjection::getWorkspaceId,
                        WorkspaceCountProjection::getCount
                ));

        return memberships.stream()
                .map(m -> {
                    Workspace w = m.getWorkspace();
                    long boardCount = boardCounts.getOrDefault(w.getId(), 0L);
                    long memberCount = memberCounts.getOrDefault(w.getId(), 0L);
                    return WorkspaceMapper.toDto(w, m.getRole().name(), (int) boardCount, (int) memberCount);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WorkspaceResponseDto getWorkspaceById(Long workspaceId, CustomUserDetails currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        WorkspaceMember membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("User is not a member of this workspace"));

        long boardCount = boardRepository.countByWorkspaceId(workspaceId);
        long memberCount = workspaceMemberRepository.countByWorkspaceId(workspaceId);

        return WorkspaceMapper.toDto(workspace, membership.getRole().name(), (int) boardCount, (int) memberCount);
    }

    @Transactional
    public WorkspaceResponseDto createWorkspace(WorkspaceCreateRequest request, CustomUserDetails currentUser) {
        User creator = userRepository.getReferenceById(currentUser.getId());

        Workspace workspace = Workspace.builder()
                .name(request.getName())
                .slug(request.getSlug())
                .description(request.getDescription())
                .createdBy(creator)
                .build();

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        // Auto-assign creator as ROLE_ADMIN of the new workspace
        WorkspaceMember adminMember = WorkspaceMember.builder()
                .workspace(savedWorkspace)
                .user(creator)
                .role(WorkspaceRole.ROLE_ADMIN)
                .build();

        workspaceMemberRepository.save(adminMember);

        return WorkspaceMapper.toDto(savedWorkspace, WorkspaceRole.ROLE_ADMIN.name(), 0, 1);
    }

    @Transactional
    public WorkspaceResponseDto updateWorkspace(Long workspaceId, WorkspaceCreateRequest request, CustomUserDetails currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        workspace.setName(request.getName());
        workspace.setDescription(request.getDescription());
        Workspace updatedWorkspace = workspaceRepository.save(workspace);

        WorkspaceRole currentRole = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .map(WorkspaceMember::getRole)
                .orElse(WorkspaceRole.ROLE_VIEWER);

        long boardCount = boardRepository.countByWorkspaceId(workspaceId);
        long memberCount = workspaceMemberRepository.countByWorkspaceId(workspaceId);

        return WorkspaceMapper.toDto(updatedWorkspace, currentRole.name(), (int) boardCount, (int) memberCount);
    }

    @Transactional
    public void deleteWorkspace(Long workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));
        workspaceRepository.delete(workspace);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponseDto> getWorkspaceMembers(Long workspaceId) {
        return workspaceMemberRepository.findAllByWorkspaceId(workspaceId).stream()
                .map(WorkspaceMemberMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public WorkspaceMemberResponseDto addWorkspaceMember(Long workspaceId, WorkspaceMemberCreateRequest request) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new EntityNotFoundException("User not found with ID: " + request.getUserId()));

        WorkspaceRole role = WorkspaceRole.valueOf(request.getRole().toUpperCase());

        WorkspaceMember member = WorkspaceMember.builder()
                .workspace(workspace)
                .user(user)
                .role(role)
                .build();

        WorkspaceMember savedMember = workspaceMemberRepository.save(member);
        return WorkspaceMemberMapper.toDto(savedMember);
    }

    @Transactional
    public void removeWorkspaceMember(Long workspaceId, Long userId) {
        WorkspaceMember membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Membership not found"));
        workspaceMemberRepository.delete(membership);
    }

    @Transactional
    public WorkspaceMemberResponseDto updateWorkspaceMemberRole(Long workspaceId, Long userId, WorkspaceMemberUpdateRequest request, CustomUserDetails currentUser) {
        WorkspaceMember targetMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Membership not found"));

        WorkspaceMember actorMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this workspace"));

        WorkspaceRole actorRole = actorMembership.getRole();
        WorkspaceRole targetOldRole = targetMembership.getRole();
        WorkspaceRole targetNewRole = WorkspaceRole.valueOf(request.getRole().toUpperCase());

        // Validate security constraints:
        // PM can change anyone's role EXCEPT Admin (target old/new cannot be ROLE_ADMIN)
        if (actorRole == WorkspaceRole.ROLE_PROJECT_MANAGER) {
            if (targetOldRole == WorkspaceRole.ROLE_ADMIN) {
                throw new AccessDeniedException("Project Managers cannot change an Admin's role.");
            }
            if (targetNewRole == WorkspaceRole.ROLE_ADMIN) {
                throw new AccessDeniedException("Project Managers cannot elevate roles to Admin.");
            }
        } else if (actorRole != WorkspaceRole.ROLE_ADMIN) {
            throw new AccessDeniedException("Only Admins and Project Managers can modify user roles.");
        }

        targetMembership.setRole(targetNewRole);
        WorkspaceMember savedMember = workspaceMemberRepository.save(targetMembership);
        return WorkspaceMemberMapper.toDto(savedMember);
    }
}
