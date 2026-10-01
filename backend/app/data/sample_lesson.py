from app.schemas.lesson import Lesson, LessonPage

TITLE = "Introduction to Computer Networks"
SECTIONS = [
    """Introduction to Computer Networks

A computer network is a group of connected devices that exchange information and share resources. Computers, phones, printers, and servers can connect through cables or wireless signals. A school network lets students access learning files stored on a server and share a printer. A local area network (LAN) connects devices in a limited area, such as one classroom or building. A wide area network (WAN) connects networks across larger distances. The internet is a network of interconnected networks.

Data is commonly divided into small units called packets before it travels through a network. A packet carries a portion of the data along with information used to deliver it, such as source and destination addresses. Packets may travel through several devices on the way to their destination. Protocols define the rules for communication; some protocols provide sequencing and retransmission so the receiver can reconstruct data reliably. Dividing data into packets allows many devices to share network links instead of reserving a whole link for a single message.

An Internet Protocol address, or IP address, identifies a network interface for communication using IP. An IPv4 address is commonly written as four numbers separated by dots, such as 192.168.1.10. Each number ranges from 0 to 255. A subnet prefix identifies which part of the address describes the network. Devices use destination IP addresses to determine where packets need to go. An IP address does not describe the contents of a packet or guarantee that delivery will succeed.""",
    """Routers, Routing Tables, and Switches

A router forwards packets between computer networks. For example, a router may connect a school's local network to another network that leads to the internet. When a router receives a packet, it examines the destination IP address and consults its routing table. It selects a matching route to determine the outgoing interface or next hop. When several routes match, the most specific matching network prefix is normally preferred.

A routing table contains information about reachable destination networks and how to reach them. Routes may be configured by an administrator or learned through routing protocols. A default route provides a path when no more specific route matches. If there is no suitable route, the router cannot simply guess the destination; the packet may be dropped. A correct destination IP address alone is therefore not enough to ensure delivery. Network links and routes must also be available.

A switch connects devices within a local network. A typical Ethernet switch learns which MAC addresses can be reached through its ports and uses this information to forward Ethernet frames. A MAC address identifies an interface at the data-link layer, while an IP address is used for communication at the network layer. Switches and routers serve different roles: a switch commonly connects devices within a LAN, while a router connects IP networks. Some devices can provide both switching and routing functions.

Consider a student sending a file to a server on another network. The student's computer divides the communication into packets. Ethernet frames carry the packets through the local switch toward the router. The router reads each packet's destination IP address and uses its routing table to forward it toward the server's network. Additional routers may forward the packet before it reaches the server. The destination uses the relevant protocols to receive and reconstruct the file. If the file cannot arrive, useful checks include the destination address, local connections, and the router's available routes.

Key ideas: networks connect devices; packets carry parts of data; IP addresses identify interfaces for IP communication; routers forward packets between networks using routing tables; switches connect devices and forward frames within a local network.""",
]


def create_sample_lesson() -> Lesson:
    pages = [LessonPage(page_number=index, text=text) for index, text in enumerate(SECTIONS, 1)]
    combined = "\n\n".join(page.text for page in pages)
    return Lesson(
        filename="introduction-to-computer-networks.sample", title=TITLE, source="sample",
        page_count=len(pages), character_count=len(combined), pages=pages,
        extracted_text=combined,
    )
