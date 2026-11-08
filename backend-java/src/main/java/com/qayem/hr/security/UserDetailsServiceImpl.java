package com.qayem.hr.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import com.qayem.hr.entity.User;
import com.qayem.hr.repository.UserRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepo;

    public UserDetailsServiceImpl(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepo.findByUsername(username.toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        if (!user.isActive() || user.isDeleted())
            throw new UsernameNotFoundException("User is inactive or deleted: " + username);

        List<GrantedAuthority> authorities = new ArrayList<>();
        if (user.getRole() != null)
            authorities.add(new SimpleGrantedAuthority(user.getRole().getName()));

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(), user.getPasswordHash(), authorities);
    }
}
