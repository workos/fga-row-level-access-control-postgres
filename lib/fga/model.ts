export const fgaModel = `version 0.2

type user

type ticket
    relation assignee [user]
    relation creator [user]
    relation parent [organization]
    relation viewer [user]

    inherit viewer if
        any_of
            relation creator
            relation assignee
            relation admin on parent [organization]
            relation agent on parent [organization]
            relation member on parent [organization]

type organization
    relation admin [user]
    relation agent [user]
    relation member [user]`; 