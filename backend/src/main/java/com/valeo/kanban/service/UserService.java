package com.valeo.kanban.service;

import com.valeo.kanban.dto.mapper.UserMapper;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Transactional(readOnly = true)
    public List<TaskDto.SimpleUserDto> getUsersInWorkspace(Long workspaceId) {
        return workspaceMemberRepository.findAllByWorkspaceIdWithUser(workspaceId).stream()
                .map(m -> UserMapper.toSimpleUserDto(m.getUser()))
                .collect(Collectors.toList());
    }
}
